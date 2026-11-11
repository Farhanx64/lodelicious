/**
 * The Cloudflare wiring that nothing else would catch before a deploy (D51): wrangler.jsonc, the
 * Worker entry and the code that depends on them must agree with each other.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { toPositional } from "../src/lib/inventory/db";
import { cronKey, isValidCronKey } from "../src/lib/jobs/cron-key";
import { JOB_NAMES } from "../src/lib/jobs/run";
import { ACTION_LIMITS } from "../src/lib/rate-limit";
import { bindingNameFor, cloudflareClientIp } from "../src/lib/rate-limit-cloudflare";
import { evaluateCloudflare } from "../src/lib/system-check";

const root = path.resolve(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

/** wrangler.jsonc is JSON with comments; strip them (no string in the file contains "//" except URLs after a colon-quote, handled by the lookbehind). */
function wranglerConfig(): {
  main: string;
  compatibility_flags: string[];
  d1_databases: { binding: string }[];
  r2_buckets: { binding: string }[];
  ratelimits: { name: string; namespace_id: string; simple: { limit: number; period: number } }[];
  triggers: { crons: string[] };
  vars: Record<string, string>;
} {
  const text = read("wrangler.jsonc")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(?<!:)\/\/.*$/gm, "");
  return JSON.parse(text);
}

describe("wrangler.jsonc", () => {
  const config = wranglerConfig();

  it("binds the database and the uploads bucket under the names the app reads", () => {
    expect(config.d1_databases.map((d) => d.binding)).toEqual(["D1"]);
    expect(config.r2_buckets.map((b) => b.binding)).toEqual(["R2"]);
    expect(config.compatibility_flags).toContain("nodejs_compat");
    expect(fs.existsSync(path.join(root, config.main))).toBe(true);
  });

  it("has a rate limiter for every limit the server actions use, with the same number", () => {
    const declared = new Map(config.ratelimits.map((r) => [r.name, r.simple]));
    for (const [action, rule] of Object.entries(ACTION_LIMITS)) {
      const simple = declared.get(bindingNameFor(rule));
      expect(simple, `${action} needs ${bindingNameFor(rule)} in wrangler.jsonc`).toEqual({ limit: rule.limit, period: rule.windowMs / 1000 });
    }
    // Two limiters sharing a namespace would share their counts.
    expect(new Set(config.ratelimits.map((r) => r.namespace_id)).size).toBe(config.ratelimits.length);
  });

  it("keeps secrets out of the file", () => {
    expect(Object.keys(config.vars)).not.toContain("PAYLOAD_SECRET");
    expect(read("wrangler.jsonc")).not.toMatch(/SECRET"\s*:/);
  });

  it("maps every Cron Trigger to known jobs in the Worker entry, and the other way round", () => {
    const worker = read("cloudflare-worker.mjs");
    const scheduleBlock = worker.slice(worker.indexOf("const SCHEDULE = {"), worker.indexOf("};", worker.indexOf("const SCHEDULE = {")));
    const active = [...scheduleBlock.matchAll(/^\s*"([^"]+)":\s*\[([^\]]*)\]/gm)].map((m) => ({ cron: m[1], jobs: [...m[2].matchAll(/"([^"]+)"/g)].map((j) => j[1]) }));
    expect(active.map((a) => a.cron).sort()).toEqual([...config.triggers.crons].sort());
    for (const { jobs } of active) for (const job of jobs) expect(JOB_NAMES).toContain(job);
  });
});

describe("cron key", () => {
  const secret = "s".repeat(64);

  it("accepts only the key for that job under that secret", () => {
    const key = cronKey("purge-carts", secret);
    expect(isValidCronKey("purge-carts", key, secret)).toBe(true);
    expect(isValidCronKey("clover-push", key, secret)).toBe(false);
    expect(isValidCronKey("purge-carts", key, "t".repeat(64))).toBe(false);
    expect(isValidCronKey("purge-carts", null, secret)).toBe(false);
    expect(isValidCronKey("purge-carts", "", secret)).toBe(false);
  });

  it("refuses everything when the secret is not set", () => {
    expect(isValidCronKey("purge-carts", cronKey("purge-carts", ""), "")).toBe(false);
    expect(isValidCronKey("purge-carts", cronKey("purge-carts", ""), undefined)).toBe(false);
  });

  it("matches what the Worker entry computes with Web Crypto", async () => {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode("cron:purge-carts"));
    const hex = [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
    expect(cronKey("purge-carts", secret)).toBe(hex);
  });
});

describe("named SQL parameters for D1", () => {
  it("lists values in the order the names appear, repeating a name used twice", () => {
    expect(toPositional({ sql: "UPDATE t SET a = :now, b = :b WHERE c <= :now", args: { b: 2, now: "N" } })).toEqual({
      sql: "UPDATE t SET a = ?, b = ? WHERE c <= ?",
      values: ["N", 2, "N"],
    });
  });

  it("leaves quoted text alone", () => {
    expect(toPositional({ sql: "SELECT ':no', \"a:b\", `c:d`, 'it''s :x' FROM t WHERE k = :k", args: { k: 1 } })).toEqual({
      sql: "SELECT ':no', \"a:b\", `c:d`, 'it''s :x' FROM t WHERE k = ?",
      values: [1],
    });
  });

  it("turns undefined into NULL and booleans into 0 or 1, and passes plain strings through", () => {
    expect(toPositional({ sql: "INSERT INTO t VALUES (:a, :b, :c)", args: { a: undefined, b: true, c: null } }).values).toEqual([null, 1, null]);
    expect(toPositional("SELECT 1")).toEqual({ sql: "SELECT 1", values: [] });
  });

  it("fails on a name with no value instead of binding the wrong thing", () => {
    expect(() => toPositional({ sql: "SELECT :missing", args: {} })).toThrow(/:missing/);
  });
});

describe("Cloudflare client address", () => {
  const headers = (h: Record<string, string>) => ({ get: (name: string) => h[name] ?? null });

  it("uses CF-Connecting-IP and ignores X-Forwarded-For, which a visitor can send", () => {
    expect(cloudflareClientIp(headers({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "1.2.3.4" }))).toBe("203.0.113.9");
    expect(cloudflareClientIp(headers({ "x-forwarded-for": "1.2.3.4" }))).toBe("unknown");
  });
});

describe("Cloudflare system check", () => {
  const good = { appEnv: "production", payloadSecretLength: 64, bindings: ["D1", "R2", "ASSETS"], requiredBindings: ["D1", "R2"] };

  it("passes a complete Worker and names a missing binding or secret", () => {
    expect(evaluateCloudflare(good).filter((r) => !r.ok)).toEqual([]);
    expect(evaluateCloudflare({ ...good, bindings: ["D1"] }).filter((r) => !r.ok).map((r) => r.check)).toEqual(["Binding R2"]);
    expect(evaluateCloudflare({ ...good, payloadSecretLength: 0 }).filter((r) => !r.ok).map((r) => r.check)).toEqual(["PAYLOAD_SECRET"]);
    expect(evaluateCloudflare({ ...good, appEnv: undefined }).filter((r) => !r.ok).map((r) => r.check)).toEqual(["APP_ENV"]);
  });
});

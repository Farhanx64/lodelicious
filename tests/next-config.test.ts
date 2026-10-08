/**
 * next.config.ts as Next reads it (A08): no X-Powered-By, the security headers, and HSTS only
 * for a production build. The config file itself is imported, so a wiring slip shows up here.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import nextConfig from "../next.config";

type Rule = { source: string; headers: { key: string; value: string }[] };

async function rulesFor(env: { NODE_ENV: string; APP_ENV?: string }): Promise<Rule[]> {
  vi.stubEnv("NODE_ENV", env.NODE_ENV);
  if (env.APP_ENV === undefined) vi.stubEnv("APP_ENV", "");
  else vi.stubEnv("APP_ENV", env.APP_ENV);
  return (await nextConfig.headers!()) as Rule[];
}

const hsts = (rules: Rule[]) => rules.flatMap((r) => r.headers).find((h) => h.key === "Strict-Transport-Security")?.value;

afterEach(() => vi.unstubAllEnvs());

describe("next.config.ts", () => {
  it("does not advertise the framework (neither Next nor Payload)", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    const rules = await rulesFor({ NODE_ENV: "production", APP_ENV: "production" });
    expect(rules.flatMap((r) => r.headers).map((h) => h.key)).not.toContain("X-Powered-By");
  });

  it("keeps Payload's own headers and adds ours on every path", async () => {
    const rules = await rulesFor({ NODE_ENV: "production", APP_ENV: "production" });
    const keys = rules.flatMap((r) => r.headers).map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining(["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Accept-CH"]));
    // The receipt pages' stricter referrer rule survives withPayload's wrapping.
    expect(rules.find((r) => r.source === "/order/:path*")?.headers).toEqual([{ key: "Referrer-Policy", value: "no-referrer" }]);
  });

  it("turns HSTS on only for a production build", async () => {
    expect(hsts(await rulesFor({ NODE_ENV: "production", APP_ENV: "production" }))).toBe("max-age=31536000");
    // An unset APP_ENV counts as production (A09).
    expect(hsts(await rulesFor({ NODE_ENV: "production" }))).toBe("max-age=31536000");
    expect(hsts(await rulesFor({ NODE_ENV: "production", APP_ENV: "staging" }))).toBeUndefined();
    expect(hsts(await rulesFor({ NODE_ENV: "production", APP_ENV: "local" }))).toBeUndefined();
    expect(hsts(await rulesFor({ NODE_ENV: "development", APP_ENV: "production" }))).toBeUndefined();
  });
});

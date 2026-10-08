/**
 * Unit tests for the Clover adapters and error types (D43). Nothing here touches a network: the
 * HTTP adapter only ever gets a hand-made `fetch`, to check its refusals, URLs and error mapping.
 */
import { describe, expect, it } from "vitest";

import { afterFailure, backoffMs, OUTBOX_MAX_ATTEMPTS } from "../inventory/outbox";

import { CloverPermanentError, CloverTransientError, isFatal, isPermanent, isTransient } from "./adapter";
import { FakeCloverAdapter } from "./fake-adapter";
import { cloverConfigured, getCloverAdapter } from "./get-adapter";
import { HttpCloverAdapter } from "./http-adapter";

const FULL = { CLOVER_ENVIRONMENT: "sandbox", CLOVER_MERCHANT_ID: "SANDBOXMID01", CLOVER_API_TOKEN: "secret-token-value" };

describe("error types", () => {
  it("separate transient from permanent failures", () => {
    const t = new CloverTransientError("slow", "timeout");
    const p = new CloverPermanentError("nope", "rejected");
    expect([isTransient(t), isPermanent(t), isTransient(p), isPermanent(p)]).toEqual([true, false, false, true]);
    expect(t.transient).toBe(true);
    expect(p.transient).toBe(false);
    expect(isFatal(new CloverPermanentError("x", "auth"))).toBe(true);
    expect(isFatal(p)).toBe(false);
    expect(isFatal(new Error("bug"))).toBe(false);
  });
});

describe("retry timing the worker relies on", () => {
  it("doubles from 30 s, is capped, and is dead after the last attempt", () => {
    expect([1, 2, 3].map(backoffMs)).toEqual([30_000, 60_000, 120_000]);
    expect(backoffMs(40)).toBe(6 * 3600_000);
    const now = new Date("2026-10-07T12:00:00Z");
    expect(afterFailure(1, now)).toEqual({ status: "failed", nextAttemptAt: "2026-10-07T12:00:30.000Z" });
    expect(afterFailure(OUTBOX_MAX_ATTEMPTS - 1, now).status).toBe("failed");
    expect(afterFailure(OUTBOX_MAX_ATTEMPTS, now)).toEqual({ status: "dead", nextAttemptAt: null });
  });
});

describe("FakeCloverAdapter", () => {
  const items = [1, 2, 3, 4, 5].map((n) => ({ cloverId: `ITEM${n}`, name: `Item ${n}`, quantity: n * 10 }));

  it("pages through items and records calls", async () => {
    const fake = new FakeCloverAdapter(items);
    const a = await fake.listItems({ cursor: null, limit: 2 });
    const b = await fake.listItems({ cursor: a.nextCursor, limit: 2 });
    const c = await fake.listItems({ cursor: b.nextCursor, limit: 2 });
    expect([a, b, c].map((p) => p.items.length)).toEqual([2, 2, 1]);
    expect(c.nextCursor).toBeNull();
    expect(fake.callsTo("listItems")).toHaveLength(3);
  });

  it("applies a change once per idempotency key", async () => {
    const fake = new FakeCloverAdapter(items);
    const change = { cloverId: "ITEM1", delta: -3, quantityAfter: 7, idempotencyKey: "k1" };
    expect(await fake.pushStockChange(change)).toEqual({ applied: true, quantity: 7 });
    expect(await fake.pushStockChange(change)).toEqual({ applied: false, quantity: 7 });
    expect(fake.quantityOf("ITEM1")).toBe(7);
  });

  it("can be scripted to time out, throttle, fail with 5xx or be rejected", async () => {
    const fake = new FakeCloverAdapter(items).timeoutNext("getItemStock").throttleNext("getItemStock", 5000).serverErrorNext("getItemStock").rejectNext("getItemStock", "not_found");
    await expect(fake.getItemStock("ITEM1")).rejects.toMatchObject({ kind: "timeout", transient: true });
    await expect(fake.getItemStock("ITEM1")).rejects.toMatchObject({ kind: "rate_limited", retryAfterMs: 5000 });
    await expect(fake.getItemStock("ITEM1")).rejects.toMatchObject({ kind: "server" });
    await expect(fake.getItemStock("ITEM1")).rejects.toMatchObject({ kind: "not_found", transient: false });
    expect((await fake.getItemStock("ITEM1")).quantity).toBe(10);
  });

  it("can apply a change and still report a timeout, like a request whose answer was lost", async () => {
    const fake = new FakeCloverAdapter(items).timeoutNext("pushStockChange", 1, { applyFirst: true });
    const change = { cloverId: "ITEM2", delta: -1, quantityAfter: 19, idempotencyKey: "k2" };
    await expect(fake.pushStockChange(change)).rejects.toBeInstanceOf(CloverTransientError);
    expect(fake.quantityOf("ITEM2")).toBe(19);
    expect((await fake.pushStockChange(change)).applied).toBe(false);
    expect(fake.quantityOf("ITEM2")).toBe(19);
  });
});

describe("HttpCloverAdapter refuses to run unless it is safe", () => {
  const refuses = (env: Record<string, string | undefined>, text: RegExp) => {
    expect(() => new HttpCloverAdapter(env)).toThrow(text);
    try {
      new HttpCloverAdapter(env);
    } catch (e) {
      expect(e).toBeInstanceOf(CloverPermanentError);
      expect((e as CloverPermanentError).kind).toBe("config");
      expect((e as Error).message).not.toContain(env.CLOVER_API_TOKEN || "\u0000never");
    }
  };

  it("needs environment, merchant ID and token", () => {
    refuses({}, /CLOVER_ENVIRONMENT, CLOVER_MERCHANT_ID, CLOVER_API_TOKEN/);
    refuses({ ...FULL, CLOVER_API_TOKEN: "" }, /CLOVER_API_TOKEN not set/);
    refuses({ ...FULL, CLOVER_MERCHANT_ID: undefined }, /CLOVER_MERCHANT_ID not set/);
    refuses({ ...FULL, CLOVER_ENVIRONMENT: undefined }, /CLOVER_ENVIRONMENT not set/);
  });

  it("refuses an unknown environment and a malformed merchant ID", () => {
    refuses({ ...FULL, CLOVER_ENVIRONMENT: "staging" }, /must be "sandbox" or "production"/);
    refuses({ ...FULL, CLOVER_MERCHANT_ID: "../../evil" }, /merchant ID/);
  });

  it("refuses production unless CLOVER_SYNC_LIVE=1", () => {
    refuses({ ...FULL, CLOVER_ENVIRONMENT: "production" }, /CLOVER_SYNC_LIVE=1/);
    refuses({ ...FULL, CLOVER_ENVIRONMENT: "production", CLOVER_SYNC_LIVE: "true" }, /CLOVER_SYNC_LIVE=1/);
    expect(() => new HttpCloverAdapter({ ...FULL, CLOVER_ENVIRONMENT: "production", CLOVER_SYNC_LIVE: "1" })).not.toThrow();
  });

  it("builds the sandbox URLs and sends the token only as a bearer header (fetch is a stub)", async () => {
    const seen: { url: string; method: string; headers: Record<string, string>; body?: string }[] = [];
    const fetchStub = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
      seen.push({ url, ...init });
      if (url.includes("/items?")) return Response.json({ elements: [{ id: "ABC123XYZ", name: "Bar", itemStock: { quantity: 4 } }, { id: "NOSTOCK01", name: "Loose" }] });
      return Response.json({ quantity: 4 });
    };
    const http = new HttpCloverAdapter(FULL, { fetch: fetchStub });
    const page = await http.listItems({ cursor: null, limit: 500 });
    expect(page.items).toEqual([
      { cloverId: "ABC123XYZ", name: "Bar", quantity: 4 },
      { cloverId: "NOSTOCK01", name: "Loose", quantity: null },
    ]);
    expect(seen[0].url).toBe("https://apisandbox.dev.clover.com/v3/merchants/SANDBOXMID01/items?expand=itemStock&limit=100&offset=0");
    expect(seen[0].headers.Authorization).toBe("Bearer secret-token-value");
    await http.pushStockChange({ cloverId: "ABC123XYZ", delta: -1, quantityAfter: 3, idempotencyKey: "stock_changed:x" });
    const post = seen.at(-1)!;
    expect(post.method).toBe("POST");
    expect(post.url).toBe("https://apisandbox.dev.clover.com/v3/merchants/SANDBOXMID01/item_stocks/ABC123XYZ");
    expect(JSON.parse(post.body!)).toEqual({ quantity: 3 });
    expect(post.headers["Idempotency-Key"]).toBe("stock_changed:x");
    await expect(http.getItemStock("../x")).rejects.toMatchObject({ kind: "rejected" });
  });

  it("maps HTTP answers to transient and permanent errors (fetch is a stub)", async () => {
    const answer = (status: number, headers: Record<string, string> = {}) => new HttpCloverAdapter(FULL, { fetch: async () => new Response("{}", { status, headers }) });
    await expect(answer(429, { "retry-after": "12" }).getItemStock("ABC123XYZ")).rejects.toMatchObject({ kind: "rate_limited", retryAfterMs: 12_000 });
    await expect(answer(503).getItemStock("ABC123XYZ")).rejects.toMatchObject({ kind: "server", transient: true });
    await expect(answer(401).getItemStock("ABC123XYZ")).rejects.toMatchObject({ kind: "auth", transient: false });
    await expect(answer(404).getItemStock("ABC123XYZ")).rejects.toMatchObject({ kind: "not_found" });
    await expect(answer(422).getItemStock("ABC123XYZ")).rejects.toMatchObject({ kind: "rejected" });
    const timedOut = new HttpCloverAdapter(FULL, {
      fetch: async () => {
        throw Object.assign(new Error("aborted"), { name: "TimeoutError" });
      },
    });
    await expect(timedOut.getItemStock("ABC123XYZ")).rejects.toMatchObject({ kind: "timeout", transient: true });
  });
});

describe("getCloverAdapter", () => {
  it("picks none, fake or http", () => {
    expect(getCloverAdapter({})).toMatchObject({ kind: "none" });
    expect(getCloverAdapter({ CLOVER_ENVIRONMENT: "sandbox" })).toMatchObject({ kind: "none" });
    expect(getCloverAdapter({ CLOVER_ADAPTER: "fake", APP_ENV: "local" }).kind).toBe("fake");
    expect(getCloverAdapter(FULL).kind).toBe("http");
  });

  it("refuses the fake on the live store, and incomplete or live config", () => {
    expect(() => getCloverAdapter({ CLOVER_ADAPTER: "fake" })).toThrow(/only allowed/);
    expect(() => getCloverAdapter({ CLOVER_ADAPTER: "fake", APP_ENV: "production" })).toThrow(/only allowed/);
    expect(() => getCloverAdapter({ CLOVER_MERCHANT_ID: "SANDBOXMID01" })).toThrow(/CLOVER_API_TOKEN/);
    expect(() => getCloverAdapter({ ...FULL, CLOVER_ENVIRONMENT: "production" })).toThrow(/CLOVER_SYNC_LIVE/);
  });

  it("reports whether Clover is configured", () => {
    expect(cloverConfigured({})).toBe(false);
    expect(cloverConfigured(FULL)).toBe(true);
  });
});

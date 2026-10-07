import { describe, expect, it } from "vitest";

import { ACTION_LIMITS, TOO_MANY_ATTEMPTS, clientIp, createRateLimiter, withinLimit } from "./rate-limit";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}
const RULE = { limit: 3, windowMs: 60_000 };

describe("createRateLimiter", () => {
  it("allows up to the limit, then denies and says how long to wait", () => {
    const c = clock();
    const limiter = createRateLimiter({ now: c.now });
    expect([1, 2, 3].map(() => limiter.hit("a", RULE).allowed)).toEqual([true, true, true]);
    c.advance(10_000);
    expect(limiter.hit("a", RULE)).toEqual({ allowed: false, retryAfterMs: 50_000 });
  });

  it("lets attempts through again once the window has passed", () => {
    const c = clock();
    const limiter = createRateLimiter({ now: c.now });
    for (let i = 0; i < 3; i++) limiter.hit("a", RULE);
    expect(limiter.hit("a", RULE).allowed).toBe(false);
    c.advance(60_000);
    expect(limiter.hit("a", RULE).allowed).toBe(true);
  });

  it("slides: old attempts expire one at a time", () => {
    const c = clock();
    const limiter = createRateLimiter({ now: c.now });
    limiter.hit("a", RULE); // t=0
    c.advance(30_000);
    limiter.hit("a", RULE); // t=30s
    limiter.hit("a", RULE); // t=30s
    expect(limiter.hit("a", RULE).allowed).toBe(false);
    c.advance(30_000); // the first attempt (t=0) is now out of the window
    expect(limiter.hit("a", RULE).allowed).toBe(true);
    expect(limiter.hit("a", RULE).allowed).toBe(false);
  });

  it("does not count denied attempts, so waiting out the window always works", () => {
    const c = clock();
    const limiter = createRateLimiter({ now: c.now });
    for (let i = 0; i < 3; i++) limiter.hit("a", RULE);
    for (let i = 0; i < 50; i++) limiter.hit("a", RULE);
    c.advance(60_000);
    expect(limiter.hit("a", RULE).allowed).toBe(true);
  });

  it("keeps keys separate", () => {
    const limiter = createRateLimiter({ now: clock().now });
    for (let i = 0; i < 3; i++) limiter.hit("1.1.1.1", RULE);
    expect(limiter.hit("1.1.1.1", RULE).allowed).toBe(false);
    expect(limiter.hit("2.2.2.2", RULE).allowed).toBe(true);
  });

  it("bounds memory under a flood of distinct keys", () => {
    const c = clock();
    const limiter = createRateLimiter({ now: c.now, maxKeys: 50 });
    for (let i = 0; i < 500; i++) limiter.hit(`ip-${i}`, RULE);
    expect(limiter.size()).toBeLessThanOrEqual(50);
    // Expired keys are dropped first: after the window everything older goes.
    c.advance(61_000);
    for (let i = 0; i < 60; i++) limiter.hit(`later-${i}`, RULE);
    expect(limiter.size()).toBeLessThanOrEqual(50);
  });
});

describe("withinLimit", () => {
  it("limits each action separately per IP", () => {
    const limiter = createRateLimiter({ now: clock().now });
    for (let i = 0; i < ACTION_LIMITS.contact.limit; i++) expect(withinLimit("contact", "9.9.9.9", limiter)).toBe(true);
    expect(withinLimit("contact", "9.9.9.9", limiter)).toBe(false);
    expect(withinLimit("fountain", "9.9.9.9", limiter)).toBe(true);
    expect(withinLimit("contact", "8.8.8.8", limiter)).toBe(true);
  });

  it("gives order and reservation submissions a tighter limit than browsing actions", () => {
    expect(ACTION_LIMITS.submitOrder.limit).toBeLessThan(ACTION_LIMITS.addToBag.limit);
    expect(ACTION_LIMITS.submitReservation.limit).toBeLessThan(ACTION_LIMITS.checkBasket.limit);
  });

  it("has a friendly message that says to wait a minute", () => {
    expect(TOO_MANY_ATTEMPTS).toBe("Too many attempts, please wait a minute and try again.");
  });
});

describe("clientIp", () => {
  const headers = (h: Record<string, string>) => ({ get: (name: string) => h[name.toLowerCase()] ?? null });

  it("uses the address the nearest proxy appended, not one the client claims", () => {
    expect(clientIp(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("falls back to X-Real-IP, then to one shared bucket", () => {
    expect(clientIp(headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(headers({}))).toBe("unknown");
    expect(clientIp(headers({ "x-forwarded-for": " " }))).toBe("unknown");
  });
});

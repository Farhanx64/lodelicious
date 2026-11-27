import { describe, expect, it } from "vitest";

import { edgeRedirect, visitorScheme } from "@/src/lib/edge-redirect.mjs";

const req = (url: string, init: { scheme?: string; method?: string } = {}) =>
  new Request(url, { method: init.method ?? "GET", headers: init.scheme ? { "cf-visitor": JSON.stringify({ scheme: init.scheme }) } : {} });

describe("edge redirects (security audit 2026-11-26)", () => {
  it("sends plain http to https on the shop's host, keeping path and query", () => {
    const r = edgeRedirect(req("http://shoplodelicious.com/shop?q=fudge", { scheme: "http" }))!;
    expect(r.status).toBe(301);
    expect(r.headers.get("Location")).toBe("https://shoplodelicious.com/shop?q=fudge");
  });
  it("never redirects an https visit, even when the internal URL says http (the 2026-11-20 loop)", () => {
    expect(edgeRedirect(req("http://shoplodelicious.com/", { scheme: "https" }))).toBeNull();
    expect(edgeRedirect(req("https://shoplodelicious.com/", { scheme: "https" }))).toBeNull();
    expect(edgeRedirect(req("https://shoplodelicious.com/"))).toBeNull();
  });
  it("sends www to the apex, the bare root included", () => {
    expect(edgeRedirect(req("https://www.shoplodelicious.com/", { scheme: "https" }))!.headers.get("Location")).toBe("https://shoplodelicious.com/");
    expect(edgeRedirect(req("https://www.shoplodelicious.com/gift-baskets", { scheme: "https" }))!.headers.get("Location")).toBe("https://shoplodelicious.com/gift-baskets");
  });
  it("keeps the method for form posts (308)", () => {
    expect(edgeRedirect(req("http://shoplodelicious.com/checkout", { scheme: "http", method: "POST" }))!.status).toBe(308);
  });
  it("leaves other hosts alone (workers.dev, cron, previews)", () => {
    expect(edgeRedirect(req("http://lodelicious.example.workers.dev/", { scheme: "http" }))).toBeNull();
    expect(edgeRedirect(req("https://cron.internal/ops/cron/x"))).toBeNull();
  });
  it("ignores a missing or garbled cf-visitor header", () => {
    expect(visitorScheme(null)).toBeNull();
    expect(visitorScheme("{nope")).toBeNull();
    expect(visitorScheme('{"scheme":"ftp"}')).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { HSTS_VALUE, csrfOrigins, securityHeaders } from "./security";

const headerValue = (rules: ReturnType<typeof securityHeaders>, source: string, key: string): string | undefined => {
  // Mirrors Next: for one path and one header, the last matching rule wins.
  const matching = rules.filter((r) => r.source === source || r.source === "/:path*");
  return matching.flatMap((r) => r.headers).filter((h) => h.key === key).at(-1)?.value;
};

describe("securityHeaders (A08)", () => {
  const rules = securityHeaders({ hsts: false });

  it("sets frame, sniffing and referrer protection on every path", () => {
    expect(rules[0].source).toBe("/:path*");
    const headers = Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]));
    expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("sends no referrer from the receipt pages, whose URL carries the guest token", () => {
    expect(headerValue(rules, "/order/:path*", "Referrer-Policy")).toBe("no-referrer");
    expect(headerValue(rules, "/reservation/:path*", "Referrer-Policy")).toBe("no-referrer");
    expect(headerValue(rules, "/shop/:path*", "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    // The specific rules must come after the global one, or the global rule would win.
    expect(rules.findIndex((r) => r.source === "/order/:path*")).toBeGreaterThan(0);
    expect(rules.findIndex((r) => r.source === "/reservation/:path*")).toBeGreaterThan(0);
  });

  it("adds HSTS only when asked, without includeSubDomains or preload", () => {
    expect(headerValue(rules, "/", "Strict-Transport-Security")).toBeUndefined();
    const withHsts = securityHeaders({ hsts: true });
    expect(headerValue(withHsts, "/", "Strict-Transport-Security")).toBe(HSTS_VALUE);
    expect(HSTS_VALUE).toBe("max-age=31536000");
    expect(HSTS_VALUE).not.toMatch(/includeSubDomains|preload/i);
  });
});

describe("csrfOrigins (A08)", () => {
  it("is empty when NEXT_PUBLIC_SITE_URL is unset, so local development and tests keep working", () => {
    expect(csrfOrigins({})).toEqual([]);
    expect(csrfOrigins({ NEXT_PUBLIC_SITE_URL: "" })).toEqual([]);
    expect(csrfOrigins({ NEXT_PUBLIC_SITE_URL: "   " })).toEqual([]);
  });

  it("reduces the site URL to the origin the browser sends (no path, no trailing slash)", () => {
    expect(csrfOrigins({ NEXT_PUBLIC_SITE_URL: "https://souset-pink.com/" })).toEqual(["https://souset-pink.com"]);
    expect(csrfOrigins({ NEXT_PUBLIC_SITE_URL: "https://souset-pink.com/shop?x=1" })).toEqual(["https://souset-pink.com"]);
    expect(csrfOrigins({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toEqual(["http://localhost:3000"]);
  });

  it("accepts several comma-separated origins, such as the apex and www, without duplicates", () => {
    expect(csrfOrigins({ NEXT_PUBLIC_SITE_URL: "https://souset-pink.com, https://www.souset-pink.com/, https://souset-pink.com" })).toEqual([
      "https://souset-pink.com",
      "https://www.souset-pink.com",
    ]);
  });

  describe("with an unusable value", () => {
    afterEach(() => vi.restoreAllMocks());

    it("stays off and says so, rather than accepting something odd", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      expect(csrfOrigins({ NEXT_PUBLIC_SITE_URL: "souset-pink.com" })).toEqual([]);
      expect(csrfOrigins({ NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" })).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(2);
    });
  });
});

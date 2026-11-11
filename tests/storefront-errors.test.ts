/**
 * Branded storefront error and not-found pages, and receipt links with a repeated `t`
 * parameter (A16, D41). A repeated parameter used to crash the token hash with a 500.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findByToken: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/src/lib/checkout/service", () => ({ findByToken: mocks.findByToken }));
vi.mock("@/src/lib/checkout/session", () => ({ checkoutPayload: async () => ({ payload: {}, ctx: {} }) }));
vi.mock("@/src/lib/store", () => ({ getStoreSettings: async () => ({ name: "Souset-Pink", street: "24 Manomet Point Rd.", locality: "Plymouth, MA" }) }));

import OrderPage from "@/app/(frontend)/order/[number]/page";
import StorefrontError from "@/app/(frontend)/error";
import StorefrontNotFound, { metadata } from "@/app/(frontend)/not-found";
import ReservationPage from "@/app/(frontend)/reservation/[number]/page";
import { singleParam } from "@/src/lib/checkout/token-param";

describe("singleParam", () => {
  it("passes a single string through and turns everything else into 'no token'", () => {
    expect(singleParam("abc")).toBe("abc");
    expect(singleParam(["a", "b"])).toBeUndefined();
    expect(singleParam([])).toBeUndefined();
    expect(singleParam(undefined)).toBeUndefined();
  });
});

describe("receipt pages with ?t=a&t=b", () => {
  it.each([
    ["order", OrderPage, "orders"],
    ["reservation", ReservationPage, "reservations"],
  ] as const)("%s page gives a 404, not a crash, when t is repeated", async (_name, Page, collection) => {
    mocks.findByToken.mockReset();
    mocks.findByToken.mockResolvedValue(null);
    await expect(Page({ params: Promise.resolve({ number: "SP-1001" }), searchParams: Promise.resolve({ t: ["a", "b"] }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.findByToken).toHaveBeenCalledWith({}, collection, "SP-1001", undefined);
  });

  it("still passes a normal token through", async () => {
    mocks.findByToken.mockReset();
    mocks.findByToken.mockResolvedValue(null);
    await expect(OrderPage({ params: Promise.resolve({ number: "SP-1001" }), searchParams: Promise.resolve({ t: "token-1" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.findByToken).toHaveBeenCalledWith({}, "orders", "SP-1001", "token-1");
  });
});

describe("branded error pages", () => {
  it("not-found has one h1, a way back, no index, and reads nothing from the database", () => {
    const html = renderToStaticMarkup(createElement(StorefrontNotFound));
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain("find that page");
    expect(html).toContain('href="/shop"');
    expect(html).toContain('href="/contact"');
    expect(metadata.robots).toEqual({ index: false });
  });

  it("the error page offers a retry and a way out, and never shows the error's message", () => {
    const error = Object.assign(new Error("SQLITE_BUSY: database is locked at /home/lody/secret"), { digest: "abc123" });
    const html = renderToStaticMarkup(createElement(StorefrontError, { error, retry: () => undefined }));
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/shop"');
    expect(html).toContain("Reference: abc123");
    expect(html).not.toContain("SQLITE_BUSY");
    expect(html).not.toContain("/home/lody");
  });
});

import { describe, expect, it } from "vitest";

import type { Product } from "@/payload-types";

import { sellableUnits } from "../catalog/product";
import { isFresh, viewProduct, viewStock, type ViewContext } from "./sellable";

const NOW = new Date("2026-10-06T12:00:00Z");
const HOUR = 3600_000;

function product(patch: Partial<Product> = {}): Product {
  return {
    id: 1,
    title: "Chocolate bar",
    channel: "online",
    priceCents: 425,
    priceApproved: true,
    stockState: "known",
    stockQuantity: 10,
    lowStockThreshold: 3,
    onlineReserve: 1,
    stockCountedAt: "2026-10-06T10:00:00Z",
    updatedAt: "",
    createdAt: "",
    ...patch,
  } as Product;
}

function ctx(patch: Partial<ViewContext> = {}, others: Product[] = []): ViewContext {
  const byId = new Map(others.map((p) => [String(p.id), p]));
  return { now: NOW, maxAgeMs: null, holds: new Map(), productById: (id) => byId.get(id), ...patch };
}

describe("isFresh (INV 05)", () => {
  it("is always fresh when no age limit is set, even without a date", () => {
    expect(isFresh(null, NOW, null)).toBe(true);
  });
  it("needs a date inside the limit when one is set", () => {
    expect(isFresh("2026-10-06T10:00:00Z", NOW, 3 * HOUR)).toBe(true);
    expect(isFresh("2026-10-06T08:00:00Z", NOW, 3 * HOUR)).toBe(false);
    expect(isFresh(null, NOW, 3 * HOUR)).toBe(false);
    expect(isFresh("not a date", NOW, 3 * HOUR)).toBe(false);
  });
});

describe("viewStock", () => {
  it("subtracts holds from counted stock and never below zero", () => {
    expect(viewStock({ stockState: "known", stockQuantity: 5 }, 2, NOW, null)).toEqual({ state: "known", quantity: 3 });
    expect(viewStock({ stockState: "known", stockQuantity: 5 }, 9, NOW, null)).toEqual({ state: "known", quantity: 0 });
  });
  it("keeps unknown stock unknown and marks old counts stale", () => {
    expect(viewStock({ stockState: "unknown", stockQuantity: null }, 0, NOW, null)).toEqual({ state: "unknown", stale: false });
    expect(viewStock({ stockState: "known", stockQuantity: 5, stockCountedAt: "2026-10-01T00:00:00Z" }, 0, NOW, 24 * HOUR)).toEqual({ state: "unknown", stale: true });
  });
});

describe("viewProduct: holds (INV 04)", () => {
  it("lowers what the shop can sell by other customers' holds, on top of the in-store reserve (D26)", () => {
    const seen = viewProduct(product(), ctx({ holds: new Map([["1", 4]]) })).product;
    // 10 counted − 4 held = 6; the downstream rule then keeps 1 back: 5 sellable.
    expect(seen.stockQuantity).toBe(6);
    const unit = sellableUnits(seen)[0];
    expect(unit.availability.purchasable).toBe(true);
  });

  it("sells out when holds take everything above the reserve", () => {
    const seen = viewProduct(product({ stockQuantity: 3 }), ctx({ holds: new Map([["1", 2]]) })).product;
    expect(sellableUnits(seen)[0].availability).toMatchObject({ status: "unavailable", purchasable: false });
  });

  it("holds options separately", () => {
    const p = product({
      variants: [
        { key: "pink", label: "Pink", stockState: "known", stockQuantity: 5 },
        { key: "blue", label: "Blue", stockState: "known", stockQuantity: 5 },
      ],
    });
    const seen = viewProduct(p, ctx({ holds: new Map([["1:pink", 4]]) })).product;
    expect(seen.variants?.map((v) => v.stockQuantity)).toEqual([1, 5]);
  });

  it("returns a copy and leaves the original alone", () => {
    const p = product();
    viewProduct(p, ctx({ holds: new Map([["1", 4]]) }));
    expect(p.stockQuantity).toBe(10);
  });
});

describe("viewProduct: stale stock (INV 05)", () => {
  it("treats an old count as unknown, so it can't be bought", () => {
    const old = product({ stockCountedAt: "2026-10-01T00:00:00Z" });
    const view = viewProduct(old, ctx({ maxAgeMs: 48 * HOUR }));
    expect(view.staleUnits).toEqual(["1"]);
    expect(sellableUnits(view.product)[0].availability).toMatchObject({ status: "unavailable", purchasable: false });
  });

  it("changes nothing while the limit is off", () => {
    const old = product({ stockCountedAt: "2026-10-01T00:00:00Z" });
    expect(viewProduct(old, ctx()).staleUnits).toEqual([]);
    expect(sellableUnits(viewProduct(old, ctx()).product)[0].availability.purchasable).toBe(true);
  });

  it("checks each option's own count date", () => {
    const p = product({
      variants: [
        { key: "pink", label: "Pink", stockState: "known", stockQuantity: 5, stockCountedAt: "2026-10-06T11:00:00Z" },
        { key: "blue", label: "Blue", stockState: "known", stockQuantity: 5, stockCountedAt: "2026-09-01T00:00:00Z" },
      ],
    });
    const view = viewProduct(p, ctx({ maxAgeMs: 48 * HOUR }));
    expect(view.staleUnits).toEqual(["1:blue"]);
    expect(view.product.variants?.map((v) => v.stockState)).toEqual(["known", "unknown"]);
  });
});

describe("viewProduct: a basket with contents (INV 01)", () => {
  const choc = product({ id: 10, title: "Truffles", stockQuantity: 20, onlineReserve: 2 });
  const box = product({ id: 11, title: "Gift box", stockQuantity: 5, onlineReserve: 1 });
  const basket = (parts: { product: number; variantKey?: string | null; quantity: number }[], patch: Partial<Product> = {}) =>
    product({ id: 100, title: "Large basket", stockState: "unknown", stockQuantity: null, onlineReserve: 1, components: parts, ...patch });

  it("is as many baskets as its scarcest component allows, after each component's own reserve", () => {
    // truffles: (20 − 2) / 6 = 3; box: (5 − 1) / 1 = 4 → 3.
    const b = basket([{ product: 10, quantity: 6 }, { product: 11, quantity: 1 }]);
    const seen = viewProduct(b, ctx({}, [choc, box])).product;
    expect(seen).toMatchObject({ stockState: "known", stockQuantity: 3, onlineReserve: 0 });
    expect(sellableUnits(seen)[0].availability.purchasable).toBe(true);
  });

  it("does not use the basket's own stock or reserve", () => {
    const b = basket([{ product: 11, quantity: 1 }], { stockState: "known", stockQuantity: 50, onlineReserve: 40 });
    expect(viewProduct(b, ctx({}, [box])).product).toMatchObject({ stockQuantity: 4, onlineReserve: 0 });
  });

  it("counts holds on the components", () => {
    const b = basket([{ product: 11, quantity: 1 }]);
    expect(viewProduct(b, ctx({ holds: new Map([["11", 3]]) }, [box])).product.stockQuantity).toBe(1);
  });

  it("is unknown if any component is unknown, missing or stale", () => {
    const b = basket([{ product: 10, quantity: 1 }, { product: 11, quantity: 1 }]);
    const unknownBox = product({ id: 11, stockState: "unknown", stockQuantity: null });
    expect(viewProduct(b, ctx({}, [choc, unknownBox])).product).toMatchObject({ stockState: "unknown", stockQuantity: null });
    expect(viewProduct(b, ctx({}, [choc])).product.stockState).toBe("unknown");
    const stale = viewProduct(b, ctx({ maxAgeMs: HOUR }, [choc, product({ id: 11, stockCountedAt: "2026-09-01T00:00:00Z" })]));
    expect(stale.product.stockState).toBe("unknown");
    expect(stale.staleUnits).toEqual(["100"]);
  });

  it("uses an option of a component when one is named", () => {
    const ribbon = product({ id: 12, variants: [{ key: "gold", label: "Gold", stockState: "known", stockQuantity: 3 }, { key: "red", label: "Red", stockState: "unknown", stockQuantity: null }] });
    expect(viewProduct(basket([{ product: 12, variantKey: "gold", quantity: 1 }]), ctx({}, [ribbon])).product.stockQuantity).toBe(2); // (3 counted − 1 reserve) / 1
    expect(viewProduct(basket([{ product: 12, variantKey: "red", quantity: 1 }]), ctx({}, [ribbon])).product.stockState).toBe("unknown");
  });
});

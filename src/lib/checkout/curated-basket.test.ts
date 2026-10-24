/**
 * AC 03 / D38: a curated basket's price already includes its basket and presentation, so the bag
 * never adds a packaging charge. Packaging is a custom-builder fee only (the gift-engine side of
 * this guarantee is tested in src/lib/gifts/rules.test.ts).
 */
import { describe, expect, it } from "vitest";

import type { Product } from "@/payload-types";

import { priceCart } from "./cart";
import type { TaxClass } from "./tax";

const SALES_TAX: TaxClass = { id: "1", name: "Sales tax 6.25%", rateBasisPoints: 625, approved: true };
const opts = { previewStock: false, taxClasses: [SALES_TAX], defaultTaxClassId: "1" };

// A curated basket once staff have approved its price, counted its stock and put it online.
// (As seeded it is inquiry-only with an unapproved price, so it can't be bought at all.)
function curatedBasket(patch: Partial<Product> = {}): Product {
  return {
    id: 21,
    title: "Large Gift Basket",
    slug: "large-gift-basket",
    category: 8,
    channel: "online",
    priceCents: 13995,
    priceApproved: true,
    stockState: "known",
    stockQuantity: 6,
    lowStockThreshold: 3,
    onlineReserve: 1,
    basketEligible: false,
    nutFree: "unknown",
    vegan: "unknown",
    updatedAt: "",
    createdAt: "",
    ...patch,
  } as Product;
}

describe("curated baskets never get a packaging charge", () => {
  it("prices a bag with one curated basket at exactly the basket price plus tax", () => {
    const cart = priceCart([{ unitId: "21", quantity: 1 }], [curatedBasket()], opts);
    expect(cart.lines).toHaveLength(1);
    expect(cart.payable).toHaveLength(1);
    expect(cart.payable[0]).toMatchObject({ title: "Large Gift Basket", quantity: 1, unitPriceCents: 13995, lineTotalCents: 13995, taxCents: 875 });
    // 13995 × 6.25% = 874.6875 → 875. Nothing else is added.
    expect(cart).toMatchObject({ subtotalCents: 13995, taxCents: 875, totalCents: 14870, blocking: false, itemCount: 1 });
  });

  it("scales by quantity only, with no per-basket or per-order packaging line", () => {
    const cart = priceCart([{ unitId: "21", quantity: 3 }], [curatedBasket()], opts);
    expect(cart.lines).toHaveLength(1);
    expect(cart.subtotalCents).toBe(3 * 13995);
    expect(cart.totalCents).toBe(cart.subtotalCents + cart.taxCents);
    expect(Object.keys(cart.lines[0]).filter((k) => /packag/i.test(k))).toEqual([]);
    expect(Object.keys(cart).filter((k) => /packag/i.test(k))).toEqual([]);
  });

  it("adds no packaging beside ordinary products either", () => {
    const bar = curatedBasket({ id: 7, title: "S'mores Bar", slug: "smores", priceCents: 425 });
    const cart = priceCart([{ unitId: "21", quantity: 1 }, { unitId: "7", quantity: 2 }], [curatedBasket(), bar], opts);
    expect(cart.lines.map((l) => l.title)).toEqual(["Large Gift Basket", "S'mores Bar"]);
    expect(cart.subtotalCents).toBe(13995 + 2 * 425);
  });

  it("can't be bought while inquiry-only or unapproved, as seeded (nothing is charged, so nothing to add to)", () => {
    for (const patch of [{ channel: "inquiry_only" as const }, { priceApproved: false }, { stockState: "unknown" as const, stockQuantity: null }]) {
      const cart = priceCart([{ unitId: "21", quantity: 1 }], [curatedBasket(patch)], opts);
      expect(cart).toMatchObject({ blocking: true, payable: [], subtotalCents: 0, totalCents: 0 });
    }
  });
});

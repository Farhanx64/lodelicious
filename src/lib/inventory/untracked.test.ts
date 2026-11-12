/** "Always available (stock not tracked)" (D54): uncounted products can be bought; a count always wins. */
import { describe, expect, it } from "vitest";

import type { Product } from "@/payload-types";

import { productAvailability, toBuilderProducts } from "../catalog/product";
import { priceCart } from "../checkout/cart";
import { UNTRACKED_STOCK, neverCounted, untrackedSellable, viewProduct, type ViewContext } from "./sellable";

const NOW = new Date("2026-10-06T12:00:00Z");

function product(patch: Partial<Product> = {}): Product {
  return {
    id: 7,
    title: "Gummy bears",
    channel: "online",
    priceCents: 495,
    priceApproved: true,
    stockState: "unknown",
    stockQuantity: null,
    lowStockThreshold: 3,
    onlineReserve: 1,
    stockCountedAt: null,
    alwaysAvailable: "store_default",
    maxPerGift: 1,
    updatedAt: "",
    createdAt: "",
    ...patch,
  } as Product;
}

const ctx = (untrackedDefault: boolean, patch: Partial<ViewContext> = {}, others: Product[] = []): ViewContext => {
  const byId = new Map(others.map((p) => [String(p.id), p]));
  return { now: NOW, maxAgeMs: null, holds: new Map(), productById: (id) => byId.get(id), untrackedDefault, ...patch };
};

const cart = (p: Product) => priceCart([{ unitId: String(p.id), quantity: 3 }], [p], { previewStock: false, taxClasses: [], defaultTaxClassId: null });

describe("untrackedSellable: the product's own choice, else the store default", () => {
  it("follows the store default unless the product says yes or no", () => {
    expect(untrackedSellable(product(), true)).toBe(true);
    expect(untrackedSellable(product(), false)).toBe(false);
    expect(untrackedSellable(product({ alwaysAvailable: null }), true)).toBe(true);
    expect(untrackedSellable(product({ alwaysAvailable: "yes" }), false)).toBe(true);
    expect(untrackedSellable(product({ alwaysAvailable: "no" }), true)).toBe(false);
    expect(untrackedSellable(undefined, true)).toBe(false);
  });
  it("only applies to stock that was never counted", () => {
    expect(neverCounted({ stockState: "unknown", stockCountedAt: null })).toBe(true);
    expect(neverCounted({ stockState: "known", stockQuantity: 0 })).toBe(false);
    // Counted once, now stale (or set unknown by a count): not "never counted", so the count's rules apply.
    expect(neverCounted({ stockState: "unknown", stockCountedAt: "2026-09-01T00:00:00Z" })).toBe(false);
  });
});

describe("the shop's view of an uncounted product", () => {
  it("is buyable with the store default on, and reported as untracked so checkout won't hold it", () => {
    const view = viewProduct(product(), ctx(true));
    expect(view.product).toMatchObject({ stockState: "known", stockQuantity: UNTRACKED_STOCK });
    expect(view.untrackedUnits).toEqual(["7"]);
    expect(productAvailability(view.product)).toMatchObject({ purchasable: true, label: null });
    expect(cart(view.product).payable).toEqual([expect.objectContaining({ quantity: 3, problem: null })]);
  });

  it("stays Currently unavailable with the default off, or when the product says no", () => {
    for (const view of [viewProduct(product(), ctx(false)), viewProduct(product({ alwaysAvailable: "no" }), ctx(true))]) {
      expect(view.untrackedUnits).toEqual([]);
      expect(productAvailability(view.product)).toMatchObject({ purchasable: false, label: "Currently unavailable" });
      expect(cart(view.product).blocking).toBe(true);
    }
  });

  it("is buyable when the product says yes even with the store default off", () => {
    expect(productAvailability(viewProduct(product({ alwaysAvailable: "yes" }), ctx(false)).product).purchasable).toBe(true);
  });

  it("lets a known count win: zero on the shelf is sold out, whatever the setting", () => {
    const counted = product({ stockState: "known", stockQuantity: 1, stockCountedAt: "2026-10-06T10:00:00Z", alwaysAvailable: "yes" });
    const view = viewProduct(counted, ctx(true));
    expect(view.untrackedUnits).toEqual([]);
    expect(view.product.stockQuantity).toBe(1); // 1 on hand, reserve 1 → nothing online
    expect(productAvailability(view.product).purchasable).toBe(false);
  });

  it("does not revive a stale count", () => {
    const stale = product({ stockState: "known", stockQuantity: 5, stockCountedAt: "2026-09-01T00:00:00Z", alwaysAvailable: "yes" });
    const view = viewProduct(stale, ctx(true, { maxAgeMs: 24 * 3600_000 }));
    expect(view.product.stockState).toBe("unknown");
    expect(view.untrackedUnits).toEqual([]);
    expect(productAvailability(view.product).purchasable).toBe(false);
  });

  it("applies per option: an uncounted option is untracked, a counted one keeps its count", () => {
    const withOptions = product({
      variants: [
        { key: "pink", label: "Pink", stockState: "unknown", stockQuantity: null },
        { key: "blue", label: "Blue", stockState: "known", stockQuantity: 0, stockCountedAt: "2026-10-06T10:00:00Z" },
      ] as Product["variants"],
    });
    const view = viewProduct(withOptions, ctx(true));
    expect(view.untrackedUnits).toEqual(["7:pink"]);
    expect(view.product.variants?.map((v) => [v.key, v.stockState, v.stockQuantity])).toEqual([
      ["pink", "known", UNTRACKED_STOCK],
      ["blue", "known", 0],
    ]);
  });

  it("lets a curated basket sell from untracked components, and reports those components", () => {
    const part = product({ id: 8, title: "Ribbon" });
    const counted = product({ id: 9, title: "Fudge", stockState: "known", stockQuantity: 4, stockCountedAt: "2026-10-06T10:00:00Z", onlineReserve: 0 });
    const basket = product({ id: 10, title: "Small gift basket", components: [{ product: 8, quantity: 1 }, { product: 9, quantity: 2 }] as Product["components"] });
    const view = viewProduct(basket, ctx(true, {}, [part, counted]));
    expect(view.product).toMatchObject({ stockState: "known", stockQuantity: 2 }); // the counted fudge limits it
    expect(view.untrackedUnits).toEqual(["8"]);
  });

  it("gives the gift builder a known stock too (the builder caps it at the per-gift maximum)", () => {
    const [unit] = toBuilderProducts(viewProduct(product(), ctx(true)).product);
    expect(unit.stock).toEqual({ state: "known", quantity: UNTRACKED_STOCK - 1 });
  });
});

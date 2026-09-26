import { describe, expect, it } from "vitest";

import { CATALOG, PREMIUM } from "@/tests/fixtures/gift-catalog";

import { DEFAULT_GIFT_SETTINGS as settings } from "./defaults";
import { assessFeasibility } from "./feasibility";
import type { BuilderProduct } from "./types";

const cheap = (n: number, price: number, extra: Partial<BuilderProduct> = {}): BuilderProduct[] =>
  Array.from({ length: n }, (_, i) => ({ ...CATALOG[5], id: `C${i}`, name: `c${i}`, priceCents: price, premium: false, maxPerGift: 1, ...extra }));

describe("assessFeasibility (GFT 03)", () => {
  it("computes the minimum budget as packaging plus the cheapest valid fill", () => {
    // Small: 6 items at $5.00 + $19.95 packaging = $49.95.
    const r = assessFeasibility(settings, "small", "sweet", 4995, cheap(10, 500));
    expect(r).toEqual({ feasible: true, minimumBudgetCents: 4995, smallerSizesThatFit: [] });
  });

  it("suggests smaller sizes and the budget needed when the budget is too low", () => {
    // Medium needs 10 × $5 + $24.95 = $74.95; small fits in $60.
    const r = assessFeasibility(settings, "medium", "sweet", 6000, cheap(12, 500));
    expect(r.feasible).toBe(false);
    expect(r.minimumBudgetCents).toBe(7495);
    expect(r.smallerSizesThatFit).toEqual(["small"]);
  });

  it("respects the premium cap: cheap premium items beyond the cap don't count", () => {
    // Small: premium cap 1. Five $1 premium items + five $9 plain items: 1×$1 + 5×$9 + $19.95.
    const products = [...cheap(5, 100, { premium: true }), ...cheap(5, 900).map((p, i) => ({ ...p, id: `P${i}` }))];
    expect(assessFeasibility(settings, "small", "sweet", null, products).minimumBudgetCents).toBe(100 + 4500 + 1995);
  });

  it("reports infeasible when stock can't reach the minimum count", () => {
    const r = assessFeasibility(settings, "extra_large", "sweet", null, cheap(17, 500));
    expect(r).toMatchObject({ feasible: false, minimumBudgetCents: null });
    expect(r.smallerSizesThatFit).toEqual(["large", "medium", "small"]);
  });

  it("uses the sympathy 13-item minimum for large sympathy", () => {
    const products = cheap(13, 500, { giftTypes: ["sympathy"] });
    expect(assessFeasibility(settings, "large", "sympathy", null, products).minimumBudgetCents).toBe(13 * 500 + 2995);
    expect(assessFeasibility(settings, "large", "sympathy", null, products.slice(0, 12)).feasible).toBe(false);
  });

  it("ignores ineligible, unapproved and unknown-stock products", () => {
    const products = [
      ...cheap(5, 500),
      ...cheap(3, 100, { stock: { state: "unknown" } }).map((p, i) => ({ ...p, id: `U${i}` })),
      ...cheap(3, 100, { priceApproved: false }).map((p, i) => ({ ...p, id: `A${i}` })),
    ];
    expect(assessFeasibility(settings, "small", "sweet", null, products).feasible).toBe(false);
  });

  it("works on the fixture catalog", () => {
    expect(assessFeasibility(settings, "large", "sweet", 20000, CATALOG).feasible).toBe(true);
    expect(PREMIUM.length).toBeGreaterThan(0);
  });
});

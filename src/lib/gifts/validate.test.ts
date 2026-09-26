import { describe, expect, it } from "vitest";

import { CATALOG, PREMIUM, SPECIAL_CASES as X, plainItems, sel } from "@/tests/fixtures/gift-catalog";

import { DEFAULT_GIFT_SETTINGS as SETTINGS } from "./defaults";
import type { GiftRequest, GiftSettings, GiftType, SizeCode } from "./types";
import { catalogOf, validateGift } from "./validate";

const catalog = catalogOf(CATALOG);

function custom(size: SizeCode, ids: string[], opts: { giftType?: GiftType; budgetCents?: number | null } = {}): GiftRequest {
  return { kind: "custom", size, giftType: opts.giftType ?? "sweet", budgetCents: opts.budgetCents ?? null, selections: sel(...ids) };
}

const codes = (r: ReturnType<typeof validateGift>) => r.violations.map((v) => v.code);

describe("item counts (AC 02)", () => {
  it.each([
    ["small", 6, 8],
    ["medium", 10, 12],
    ["large", 12, 14],
    ["extra_large", 18, 20],
  ] as const)("%s accepts %i–%i items", (size, min, max) => {
    expect(validateGift(custom(size, plainItems(min - 1)), SETTINGS, catalog)).toMatchObject({ valid: true, complete: false });
    expect(validateGift(custom(size, plainItems(min)), SETTINGS, catalog).complete).toBe(true);
    expect(validateGift(custom(size, plainItems(max)), SETTINGS, catalog).complete).toBe(true);
    const over = validateGift(custom(size, plainItems(max + 1)), SETTINGS, catalog);
    expect(over.valid).toBe(false);
    expect(codes(over)).toContain("COUNT_ABOVE_MAX");
  });

  it("large sympathy enforces the chart's 13–16, not the standard 12–14", () => {
    const sympathy = (n: number) => validateGift(custom("large", plainItems(n, "sympathy"), { giftType: "sympathy" }), SETTINGS, catalog);
    expect(sympathy(12).complete).toBe(false);
    expect(codes(sympathy(12))).toEqual(["COUNT_BELOW_MIN"]);
    expect(sympathy(13).complete).toBe(true);
    expect(sympathy(16).complete).toBe(true);
    expect(codes(sympathy(17))).toContain("COUNT_ABOVE_MAX");

    // Same sizes for other gift types keep the standard large range.
    expect(validateGift(custom("large", plainItems(12)), SETTINGS, catalog).complete).toBe(true);
    expect(codes(validateGift(custom("large", plainItems(15)), SETTINGS, catalog))).toContain("COUNT_ABOVE_MAX");
  });

  it("small and medium sympathy use the standard ranges", () => {
    expect(validateGift(custom("small", plainItems(6, "sympathy"), { giftType: "sympathy" }), SETTINGS, catalog).countRange).toEqual({ min: 6, max: 8 });
    expect(validateGift(custom("medium", plainItems(10, "sympathy"), { giftType: "sympathy" }), SETTINGS, catalog).countRange).toEqual({ min: 10, max: 12 });
  });

  it("counts one packaged unit as one item: two-piece pretzels and a teddy bear", () => {
    const r = validateGift(custom("small", [...plainItems(4), "P18", "C20"]), SETTINGS, catalog);
    expect(r.totals.itemCount).toBe(6);
    expect(r.complete).toBe(true);
  });
});

describe("premium caps (AC 02)", () => {
  it.each([
    ["small", 1],
    ["medium", 2],
    ["large", 3],
    ["extra_large", 4],
  ] as const)("%s allows %i premium items", (size, cap) => {
    const { min } = { small: { min: 6 }, medium: { min: 10 }, large: { min: 12 }, extra_large: { min: 18 } }[size];
    const premium = PREMIUM.map((p) => p.id);
    const atCap = validateGift(custom(size, [...premium.slice(0, cap), ...plainItems(min - cap)]), SETTINGS, catalog);
    expect(atCap.complete).toBe(true);
    expect(atCap.totals.premiumCount).toBe(cap);

    const overCap = validateGift(custom(size, [...premium.slice(0, cap + 1), ...plainItems(min - cap - 1)]), SETTINGS, catalog);
    expect(codes(overCap)).toEqual(["PREMIUM_CAP"]);
  });

  it("counts premium items toward the overall total", () => {
    const r = validateGift(custom("small", ["P01", ...plainItems(5)]), SETTINGS, catalog);
    expect(r.totals.itemCount).toBe(6);
    expect(r.complete).toBe(true);
  });

  it("uses the verified premium flag, not the product name", () => {
    const renamed = catalogOf(CATALOG.map((p) => (p.id === "P01" ? { ...p, name: "Chocolate bar" } : p)));
    const ids = ["P01", "P02", ...plainItems(4)];
    expect(codes(validateGift(custom("small", ids), SETTINGS, renamed))).toEqual(codes(validateGift(custom("small", ids), SETTINGS, catalog)));
    expect(codes(validateGift(custom("small", ids), SETTINGS, renamed))).toContain("PREMIUM_CAP");
  });
});

describe("repeats (GFT 04)", () => {
  it("allows one of each item by default", () => {
    const r = validateGift({ kind: "custom", size: "small", giftType: "sweet", budgetCents: null, selections: [{ productId: "P05", quantity: 2 }, ...sel(...plainItems(5))] }, SETTINGS, catalog);
    expect(codes(r)).toEqual(["REPEAT_LIMIT"]);
  });

  it("merges repeated lines before applying the limit", () => {
    const r = validateGift(custom("small", ["P05", "P05", ...plainItems(5)]), SETTINGS, catalog);
    expect(codes(r)).toEqual(["REPEAT_LIMIT"]);
  });

  it("treats distinct flavors as separate selections", () => {
    // Milk and dark bars are separate products.
    expect(validateGift(custom("small", ["P02", "P03", ...plainItems(4)]), { ...SETTINGS, sizes: SETTINGS.sizes.map((s) => ({ ...s, premiumCap: 2 })) }, catalog).complete).toBe(true);
  });

  it("allows configured multiples for assortments", () => {
    const r = validateGift({ kind: "custom", size: "medium", giftType: "sweet", budgetCents: null, selections: [{ productId: "P04", quantity: 2 }, ...sel(...plainItems(8))] }, SETTINGS, catalog);
    expect(r.complete).toBe(true);
    expect(r.totals.premiumCount).toBe(2);
  });
});

describe("availability and eligibility", () => {
  const withOne = (id: string, giftType: GiftType = "sweet") => validateGift(custom("small", [id, ...plainItems(5, giftType)], { giftType }), SETTINGS, catalog);

  it.each([
    ["Lebanese chocolates (in-store only)", X.lebanese.id, "Available in our shop only."],
    ["gelato (hidden)", X.gelato.id, "Not available online."],
    ["gift boxes (inquiry only)", X.giftBox.id, "Available by inquiry — please contact us."],
    ["the Baby White blanket outside Baby White", X.blanket.id, "Only included with the Baby White Basket."],
    ["unapproved prices", X.unapproved.id, "Currently unavailable."],
    ["unknown stock", X.unknownStock.id, "Currently unavailable."],
    ["stale stock", X.staleStock.id, "Currently unavailable."],
    ["sold-out products", X.soldOut.id, "Currently unavailable."],
    ["non-basket products (cards)", X.card.id, "Not available as a basket item."],
  ])("rejects %s", (_label, id, message) => {
    const r = withOne(id);
    expect(r.valid).toBe(false);
    expect(r.violations).toEqual([{ code: "NOT_ELIGIBLE", productId: id, message: `${CATALOG.find((p) => p.id === id)!.name}: ${message}` }]);
  });

  it("rejects products outside the gift type (fruit is sympathy only)", () => {
    expect(codes(withOne(X.fruit.id))).toEqual(["NOT_ELIGIBLE"]);
    expect(withOne(X.fruit.id, "sympathy").complete).toBe(true);
  });

  it("rejects more than the known stock (last unit)", () => {
    const r = validateGift({ kind: "custom", size: "small", giftType: "sweet", budgetCents: null, selections: [{ productId: X.lastOne.id, quantity: 2 }, ...sel(...plainItems(4))] }, SETTINGS, catalog);
    expect(codes(r)).toEqual(["INSUFFICIENT_STOCK"]);
  });

  it("rejects unknown products and invalid quantities", () => {
    const r = validateGift({ kind: "custom", size: "small", giftType: "sweet", budgetCents: null, selections: [{ productId: "nope", quantity: 1 }, { productId: "P05", quantity: 0 }, { productId: "P08", quantity: 1.5 }] }, SETTINGS, catalog);
    expect(codes(r)).toEqual(["UNKNOWN_PRODUCT", "INVALID_QUANTITY", "INVALID_QUANTITY", "COUNT_BELOW_MIN"]);
  });
});

describe("pricing and budget (AC 03)", () => {
  it("adds the size's packaging fee exactly once to contents", () => {
    const ids = plainItems(12);
    const r = validateGift(custom("large", ids), SETTINGS, catalog);
    const contents = ids.reduce((t, id) => t + catalog.get(id)!.priceCents!, 0);
    expect(r.totals).toMatchObject({ contentsCents: contents, packagingCents: 2995, totalCents: contents + 2995 });
  });

  it.each([
    ["small", 1995],
    ["medium", 2495],
    ["large", 2995],
    ["extra_large", 3795],
  ] as const)("%s packaging is %i cents", (size, cents) => {
    expect(validateGift(custom(size, []), SETTINGS, catalog).totals.packagingCents).toBe(cents);
  });

  it("matches the PRD example: $100 large budget leaves $70.05 for contents", () => {
    const r = validateGift(custom("large", [], { budgetCents: 10000 }), SETTINGS, catalog);
    expect(r.totals.remainingBudgetCents).toBe(7005);
  });

  it("passes at exactly the budget and fails one cent over", () => {
    const ids = plainItems(6);
    const total = validateGift(custom("small", ids), SETTINGS, catalog).totals.totalCents;
    expect(validateGift(custom("small", ids, { budgetCents: total }), SETTINGS, catalog)).toMatchObject({ complete: true, totals: { remainingBudgetCents: 0 } });
    const over = validateGift(custom("small", ids, { budgetCents: total - 1 }), SETTINGS, catalog);
    expect(codes(over)).toEqual(["OVER_BUDGET"]);
    expect(over.violations[0].message).toBe("This gift is $0.01 over your budget.");
  });

  it("reports a budget that cannot cover the packaging", () => {
    expect(codes(validateGift(custom("large", [], { budgetCents: 2000 }), SETTINGS, catalog))).toContain("BUDGET_BELOW_PACKAGING");
  });

  it("never adds packaging to a special presentation", () => {
    const settings: GiftSettings = {
      ...SETTINGS,
      specialPresentations: SETTINGS.specialPresentations.map((p) =>
        p.code === "cowboy" ? { ...p, status: "available", basePriceCents: 2500, premiumCap: 1 } : p,
      ),
    };
    const r = validateGift({ kind: "special", presentation: "cowboy", selections: sel(...plainItems(3)) }, settings, catalog);
    expect(r.complete).toBe(true);
    expect(r.totals.packagingCents).toBe(0);
    expect(r.totals.totalCents).toBe(2500 + r.totals.contentsCents);
  });

  it("uses integer cents throughout", () => {
    const r = validateGift(custom("extra_large", plainItems(20), { budgetCents: 99999 }), SETTINGS, catalog);
    for (const v of Object.values(r.totals)) if (typeof v === "number") expect(Number.isInteger(v)).toBe(true);
  });
});

describe("special presentations", () => {
  const available = (code: "cowboy" | "baby_white", patch = {}): GiftSettings => ({
    ...SETTINGS,
    specialPresentations: SETTINGS.specialPresentations.map((p) =>
      p.code === code ? { ...p, status: "available", basePriceCents: 4500, premiumCap: 1, ...patch } : p,
    ),
  });

  it("keeps Cowboy and Baby White inquiry-only while unpriced", () => {
    for (const presentation of ["cowboy", "baby_white"] as const) {
      const r = validateGift({ kind: "special", presentation, selections: sel("P19", "FX-SWEET-1", "FX-SWEET-2", "FX-SWEET-3") }, SETTINGS, catalog);
      expect(r.valid).toBe(false);
      expect(codes(r)).toContain("PRESENTATION_UNAVAILABLE");
    }
  });

  it("keeps the filled baby ceramics disabled until item counts are confirmed", () => {
    for (const presentation of ["ceramic_bowl", "ceramic_shoes", "ceramic_block"] as const) {
      const r = validateGift({ kind: "special", presentation, variant: "pink", selections: sel("P19") }, SETTINGS, catalog);
      expect(codes(r)).toContain("PRESENTATION_UNAVAILABLE");
      expect(r.totals.packagingCents).toBe(0);
    }
  });

  it("requires a valid colour for the ceramics", () => {
    const settings: GiftSettings = {
      ...SETTINGS,
      specialPresentations: SETTINGS.specialPresentations.map((p) =>
        p.code === "ceramic_shoes" ? { ...p, status: "available", premiumCap: 1 } : p,
      ),
    };
    const req = (variant?: string) => validateGift({ kind: "special", presentation: "ceramic_shoes", variant, selections: sel("P19", "FX-SWEET-1") }, settings, catalog);
    expect(codes(req())).toEqual(["VARIANT_REQUIRED"]);
    expect(codes(req("green"))).toEqual(["UNKNOWN_VARIANT"]);
    const ok = req("blue");
    expect(ok.complete).toBe(true);
    // Shoes: $19.95 container + chosen items, never the standard packaging fee.
    expect(ok.totals.totalCents).toBe(1995 + ok.totals.contentsCents);
    expect(ok.totals.packagingCents).toBe(0);
  });

  it("Cowboy takes 3–5 selections, not standard basket counts", () => {
    const settings = available("cowboy");
    const n = (k: number) => validateGift({ kind: "special", presentation: "cowboy", selections: sel(...plainItems(k)) }, settings, catalog);
    expect(n(2).complete).toBe(false);
    expect(n(3).complete).toBe(true);
    expect(n(5).complete).toBe(true);
    expect(codes(n(6))).toContain("COUNT_ABOVE_MAX");
  });

  it("Baby White counts 4–6 candy/chocolate selections; blanket and bear are included, not chosen", () => {
    const settings = available("baby_white");
    const pick = (ids: string[]) => validateGift({ kind: "special", presentation: "baby_white", selections: sel(...ids) }, settings, catalog);
    expect(pick(["P19", "FX-SWEET-1", "FX-SWEET-2", "P05"]).complete).toBe(true);
    // Savory items are not a Baby White choice.
    expect(codes(pick(["P19", "FX-SWEET-1", "FX-SWEET-2", "FX-SAVORY-1"]))).toEqual(["SPECIAL_CATEGORY"]);
    // The blanket cannot be "selected" — it is already part of the presentation.
    expect(codes(pick(["P19", "FX-SWEET-1", "FX-SWEET-2", "P05", X.blanket.id]))).toEqual(["NOT_ELIGIBLE"]);
  });

  it("supports fixed pricing when the base price covers the selections", () => {
    const r = validateGift({ kind: "special", presentation: "baby_white", selections: sel("P19", "FX-SWEET-1", "FX-SWEET-2", "P05") }, available("baby_white", { pricing: "fixed" }), catalog);
    expect(r.totals.totalCents).toBe(4500);
  });
});

describe("physical fit", () => {
  it("enforces container capacity when configured", () => {
    const settings: GiftSettings = { ...SETTINGS, sizes: SETTINGS.sizes.map((s) => (s.code === "small" ? { ...s, capacityUnits: 7 } : s)) };
    const bulky = catalogOf(CATALOG.map((p) => (p.id === "FX-SWEET-16" ? { ...p, fitUnits: 3 } : p)));
    const r = validateGift(custom("small", ["FX-SWEET-16", ...plainItems(5)]), settings, bulky);
    expect(r.totals.fitUsed).toBe(8);
    expect(codes(r)).toEqual(["FIT_EXCEEDED"]);
  });

  it("enforces counts only when capacity is not set", () => {
    const bulky = catalogOf(CATALOG.map((p) => (p.id === "FX-SWEET-16" ? { ...p, fitUnits: 3 } : p)));
    expect(validateGift(custom("small", ["FX-SWEET-16", ...plainItems(5)]), SETTINGS, bulky).complete).toBe(true);
  });
});

describe("performance (PRD target: p95 < 1 s)", () => {
  it("validates against a 2,000-product catalog quickly", () => {
    const big = catalogOf([
      ...CATALOG,
      ...Array.from({ length: 2000 }, (_, i) => ({ ...CATALOG[5], id: `BULK-${i}`, name: `Bulk ${i}` })),
    ]);
    const request = custom("extra_large", Array.from({ length: 20 }, (_, i) => `BULK-${i}`), { budgetCents: 100000 });
    const start = performance.now();
    for (let i = 0; i < 100; i++) validateGift(request, SETTINGS, big);
    expect((performance.now() - start) / 100).toBeLessThan(50);
  });
});

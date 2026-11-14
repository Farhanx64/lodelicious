import { describe, expect, it } from "vitest";

import { priceCart, retaxCart, type PricedCart } from "./cart";
import { classForBasis, percentToBasisPoints, providerTaxFor, shipTaxRulesFrom, taxBasisFor, taxLabelFor, variantOf, type ShipTaxRule } from "./ship-tax";
import type { TaxClass } from "./tax";
import { bagTaxViews, basketTaxViews, byView, retaxBasket } from "./tax-views";
import type { PricedBasket } from "./service";

const SALES: TaxClass = { id: "1", name: "Sales Tax", rateBasisPoints: 625, approved: true };
const EXEMPT: TaxClass = { id: "2", name: "Exempt", rateBasisPoints: 0, approved: true };
const MA: ShipTaxRule[] = [{ state: "MA", rateBasisPoints: 625, cloverTaxName: "Sales Tax" }];

/** A priced bag of two lines without going through the catalog. */
function bag(lines: { cents: number; taxClass: TaxClass | null }[]): PricedCart {
  const products = lines.map((l, i) => ({
    id: i + 1,
    slug: `p${i}`,
    title: `Item ${i}`,
    channel: "online",
    priceApproved: true,
    priceCents: l.cents,
    stockState: "known",
    stockQuantity: 50,
    onlineReserve: 0,
    taxClass: l.taxClass?.id ?? null,
  }));
  return priceCart(
    lines.map((_, i) => ({ unitId: String(i + 1), quantity: 1 })),
    products as never,
    { previewStock: false, taxClasses: [SALES, EXEMPT], defaultTaxClassId: SALES.id },
  );
}

describe("the rate field", () => {
  it("reads a percentage with up to two decimals as exact basis points, without float multiplication", () => {
    expect(percentToBasisPoints(6.25)).toBe(625);
    expect(percentToBasisPoints("6.25")).toBe(625);
    expect(percentToBasisPoints(7)).toBe(700);
    expect(percentToBasisPoints(0)).toBe(0);
    expect(percentToBasisPoints(6.35)).toBe(635);
    expect(percentToBasisPoints(100)).toBe(10_000);
    for (const bad of [-1, 6.255, 101, "abc", "", null, undefined]) expect(percentToBasisPoints(bad)).toBeNull();
  });
});

describe("the saved list", () => {
  it("never saved: MA at the default class's rate (today's behaviour)", () => {
    expect(shipTaxRulesFrom({}, SALES)).toEqual([{ state: "MA", rateBasisPoints: 625, cloverTaxName: null }]);
    expect(shipTaxRulesFrom({}, { ...SALES, rateBasisPoints: 700 })).toEqual([{ state: "MA", rateBasisPoints: 700, cloverTaxName: null }]);
    expect(shipTaxRulesFrom(null, null)).toEqual([]);
  });

  it("saved: exactly the rows staff left, even none; bad rows skipped, first row per state wins", () => {
    expect(shipTaxRulesFrom({ updatedAt: "2026-11-14", shipTaxStates: [] }, SALES)).toEqual([]);
    expect(
      shipTaxRulesFrom(
        {
          updatedAt: "2026-11-14",
          shipTaxStates: [
            { state: "ma", ratePercent: 6.25, cloverTaxName: "  Sales   Tax " },
            { state: "MA", ratePercent: 9 },
            { state: "NY", ratePercent: "4", cloverTaxName: "" },
            { state: "XX1", ratePercent: 5 },
            { state: "RI", ratePercent: 6.255 },
          ],
        },
        SALES,
      ),
    ).toEqual([
      { state: "MA", rateBasisPoints: 625, cloverTaxName: "Sales Tax" },
      { state: "NY", rateBasisPoints: 400, cloverTaxName: null },
    ]);
  });
});

describe("the tax basis", () => {
  it("pickup is pickup; a listed state is its rule; anything else is no tax", () => {
    expect(taxBasisFor({ method: "pickup" }, MA)).toEqual({ kind: "pickup" });
    expect(taxBasisFor({ method: "ship", state: "ma" }, MA)).toEqual({ kind: "state", state: "MA", rateBasisPoints: 625, cloverTaxName: "Sales Tax" });
    expect(taxBasisFor({ method: "ship", state: "NY" }, MA)).toEqual({ kind: "none", state: "NY" });
    expect(taxBasisFor({ method: "ship", state: "MA" }, [])).toEqual({ kind: "none", state: "MA" });
  });

  it("maps classes: pickup unchanged, a listed state's rate (exempt stays exempt), unlisted zero, approval kept", () => {
    const ny = { kind: "state", state: "NY", rateBasisPoints: 400, cloverTaxName: null } as const;
    expect(classForBasis(SALES, { kind: "pickup" })).toBe(SALES);
    expect(classForBasis(SALES, ny)).toEqual({ ...SALES, rateBasisPoints: 400 });
    expect(classForBasis(EXEMPT, ny)).toEqual(EXEMPT);
    expect(classForBasis({ ...SALES, approved: false }, { kind: "none", state: "NY" })).toEqual({ ...SALES, rateBasisPoints: 0, approved: false });
    expect(classForBasis(null, ny)).toBeNull();
  });

  it("labels the tax row and tells the payment provider", () => {
    expect(taxLabelFor({ kind: "pickup" }, true)).toBe("Tax");
    expect(taxLabelFor({ kind: "pickup" }, false)).toBe("Estimated tax (to be confirmed)");
    expect(taxLabelFor({ kind: "state", state: "MA", rateBasisPoints: 625, cloverTaxName: null }, true)).toBe("Tax (MA 6.25%)");
    expect(taxLabelFor({ kind: "none", state: "NY" }, true)).toBe("No sales tax (ships to NY)");
    expect(providerTaxFor({ kind: "pickup" })).toEqual({ kind: "default" });
    expect(providerTaxFor({ kind: "state", state: "MA", rateBasisPoints: 625, cloverTaxName: "Sales Tax" })).toEqual({ kind: "named", cloverTaxName: "Sales Tax" });
    expect(providerTaxFor({ kind: "none", state: "NY" })).toEqual({ kind: "none" });
    expect(variantOf({ kind: "none", state: "NY" })).toBe("none");
  });
});

describe("retaxing a bag", () => {
  const priced = bag([
    { cents: 850, taxClass: SALES },
    { cents: 1000, taxClass: EXEMPT },
  ]);

  it("MA shipping is identical to pickup", () => {
    const ma = retaxCart(priced, taxBasisFor({ method: "ship", state: "MA" }, MA));
    expect(priced.taxCents).toBe(53);
    expect(ma.taxCents).toBe(priced.taxCents);
    expect(ma.totalCents).toBe(priced.totalCents);
    expect(ma.payable.map((l) => l.taxCents)).toEqual(priced.payable.map((l) => l.taxCents));
  });

  it("NY shipping is untaxed; prices, subtotal and approval are unchanged", () => {
    const ny = retaxCart(priced, taxBasisFor({ method: "ship", state: "NY" }, MA));
    expect(ny).toMatchObject({ subtotalCents: 1850, taxCents: 0, totalCents: 1850, taxApproved: true });
    expect(ny.payable.map((l) => l.taxCents)).toEqual([0, 0]);
    expect(priced.taxCents).toBe(53); // the original is not changed
  });
});

describe("the pages' figures follow the same rule (incl. rewards and wallet amounts)", () => {
  const priced = bag([{ cents: 2000, taxClass: SALES }]);
  const reward = [{ id: "r5", pointsRequired: 100, discountCents: 500 }];

  it("pickup: one version, as before", () => {
    const views = bagTaxViews(priced, { method: "pickup", shippingCents: 0, rules: MA, rewards: reward });
    expect(views.map((v) => v.key)).toEqual(["pickup"]);
    expect(views[0]).toMatchObject({ totalCents: 2125, wallet: { cents: 2125, byChoice: { field: "reward", cents: { none: 2125, r5: 1594 } } } });
  });

  it("shipped: MA taxed, every other state untaxed; rewards and the wallet sheet follow; shipping never taxed", () => {
    const views = bagTaxViews(priced, { method: "ship", shippingCents: 895, rules: MA, rewards: reward });
    expect(views.map((v) => v.key)).toEqual(["MA", "none"]);
    const by = byView(views, (v) => v.wallet);
    // MA: $20 + 6.25% = $21.25, + $8.95 shipping. With the $5 reward: $15 + $0.94 + $8.95.
    expect(by.MA).toEqual({ cents: 3020, byChoice: { field: "reward", cents: { none: 3020, r5: 2489 } } });
    // Elsewhere: no sales tax. $20 + $8.95; with the reward $15 + $8.95.
    expect(by.none).toEqual({ cents: 2895, byChoice: { field: "reward", cents: { none: 2895, r5: 2395 } } });
    expect(views[1].rewards[0].label).toBe("$5.00 off for 100 points (total $15.00)");
    expect(views[1].taxNote).toMatch(/No sales tax/);
  });

  it("a basket: MA identical to pickup tax, NY untaxed, a shipped basket's wallet is the full total", () => {
    const basket = {
      ok: true,
      subtotalCents: 3000,
      taxCents: 187,
      totalCents: 3187,
      taxApproved: true,
      taxClasses: [SALES, SALES],
      taxAmounts: [2500, 500],
    } as unknown as PricedBasket;
    expect(retaxBasket(basket, taxBasisFor({ method: "ship", state: "MA" }, MA))).toMatchObject({ taxCents: 187, totalCents: 3187 });
    expect(retaxBasket(basket, taxBasisFor({ method: "ship", state: "NY" }, MA))).toMatchObject({ taxCents: 0, totalCents: 3000 });
    const views = basketTaxViews(basket, { method: "ship", shippingCents: 1000, rules: MA, deposit: { chargeNowCents: 797 }, allowPayInFull: true });
    expect(byView(views, (v) => v.wallet)).toEqual({ MA: { cents: 4187 }, none: { cents: 4000 } });
    const pickup = basketTaxViews(basket, { method: "pickup", shippingCents: 0, rules: MA, deposit: { chargeNowCents: 797 }, allowPayInFull: true });
    expect(pickup[0].wallet).toEqual({ cents: 797, byChoice: { field: "payment", cents: { deposit: 797, full: 3187 } } });
  });
});

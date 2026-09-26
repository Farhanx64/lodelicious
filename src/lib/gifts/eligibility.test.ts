import { describe, expect, it } from "vitest";

import { CATALOG, SPECIAL_CASES as X } from "@/tests/fixtures/gift-catalog";

import { DEFAULT_GIFT_SETTINGS as settings } from "./defaults";
import { checkForPicker, checkProduct } from "./eligibility";

const byId = (id: string) => CATALOG.find((p) => p.id === id)!;
const custom = { settings, target: { kind: "custom", giftType: "sweet" } } as const;

describe("checkProduct", () => {
  it("gives a specific reason for each unavailable choice", () => {
    expect(checkProduct(X.lebanese, custom)).toMatchObject({ eligible: false, reason: "in_store_only" });
    expect(checkProduct(X.gelato, custom)).toMatchObject({ eligible: false, reason: "hidden" });
    expect(checkProduct(X.giftBox, custom)).toMatchObject({ eligible: false, reason: "inquiry_only" });
    expect(checkProduct(X.blanket, custom)).toMatchObject({ eligible: false, reason: "exclusive_elsewhere" });
    expect(checkProduct(X.unapproved, custom)).toMatchObject({ eligible: false, reason: "price_not_confirmed" });
    expect(checkProduct(X.unknownStock, custom)).toMatchObject({ eligible: false, reason: "stock_uncertain" });
    expect(checkProduct(X.staleStock, custom)).toMatchObject({ eligible: false, reason: "stock_uncertain" });
    expect(checkProduct(X.soldOut, custom)).toMatchObject({ eligible: false, reason: "out_of_stock" });
    expect(checkProduct(X.card, custom)).toMatchObject({ eligible: false, reason: "not_basket_item" });
    expect(checkProduct(X.fruit, custom)).toMatchObject({ eligible: false, reason: "wrong_gift_type" });
    expect(checkProduct(byId("P05"), custom)).toEqual({ eligible: true });
  });

  it("never lets a hidden or in-store-only product through, even if everything else is valid", () => {
    // Channel wins over approval and stock.
    expect(checkProduct({ ...X.lebanese, priceApproved: true, stock: { state: "known", quantity: 50 } }, custom).eligible).toBe(false);
  });

  it("does not expose stock or approval details to customers", () => {
    for (const p of [X.unapproved, X.unknownStock, X.staleStock, X.soldOut]) {
      const r = checkProduct(p, custom);
      expect(r.eligible === false && r.message).toBe("Currently unavailable.");
    }
  });
});

describe("checkForPicker", () => {
  const ctx = (patch: Partial<Parameters<typeof checkForPicker>[1]> = {}) => ({
    ...custom,
    selectedQuantity: 0,
    remainingBudgetCents: null,
    premiumRemaining: null,
    ...patch,
  });

  it("filters by what is already chosen, remaining budget and premium allowance", () => {
    expect(checkForPicker(byId("P05"), ctx({ selectedQuantity: 1 }))).toMatchObject({ reason: "already_selected" });
    expect(checkForPicker(byId("P04"), ctx({ selectedQuantity: 1 })).eligible).toBe(true); // assortment allows 2
    expect(checkForPicker(byId("P05"), ctx({ remainingBudgetCents: 1294 }))).toMatchObject({ reason: "over_budget" });
    expect(checkForPicker(byId("P05"), ctx({ remainingBudgetCents: 1295 })).eligible).toBe(true);
    expect(checkForPicker(byId("P01"), ctx({ premiumRemaining: 0 }))).toMatchObject({ reason: "premium_limit" });
    expect(checkForPicker(byId("P05"), ctx({ premiumRemaining: 0 })).eligible).toBe(true);
    expect(checkForPicker(X.lastOne, ctx({ selectedQuantity: 1 }))).toMatchObject({ reason: "out_of_stock" });
  });
});

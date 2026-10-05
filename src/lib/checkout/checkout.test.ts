import { describe, expect, it } from "vitest";

import type { Product } from "@/payload-types";

import { getPaymentProvider, orderingState, testProvider } from "../payments";
import { priceCart } from "./cart";
import { depositFor, paymentPlan } from "./deposit";
import { assemblyInstructions, formatNumber, idempotencyKey, newAccessToken, tokenMatches } from "./order";
import { availableSlots, formatSlot, isAvailableSlot, zonedToUtc, type PickupSettings } from "./pickup";
import { computeTax, taxFor, type TaxClass } from "./tax";

const MA: TaxClass = { id: "1", name: "Sales tax", rateBasisPoints: 625, approved: false };
const EXEMPT: TaxClass = { id: "2", name: "Food — exempt", rateBasisPoints: 0, approved: true };

describe("tax (D34)", () => {
  it("rounds half-up per line in basis points", () => {
    expect(taxFor(425, MA)).toBe(27); // 26.5625 → 27
    expect(taxFor(400, MA)).toBe(25);
    expect(taxFor(1000, { ...MA, rateBasisPoints: 625 })).toBe(63); // 62.5 → 63
    expect(taxFor(500, null)).toBe(0);
  });

  it("is approved only when every line's class is approved", () => {
    expect(computeTax([{ amountCents: 425, taxClass: EXEMPT }]).approved).toBe(true);
    expect(computeTax([{ amountCents: 425, taxClass: EXEMPT }, { amountCents: 100, taxClass: MA }]).approved).toBe(false);
    expect(computeTax([{ amountCents: 425, taxClass: null }]).approved).toBe(false);
  });
});

describe("deposit (D36)", () => {
  const pct = { type: "percent" as const, percentBasisPoints: 2500, flatCents: 0 };
  const flat = { type: "flat" as const, percentBasisPoints: 0, flatCents: 2000 };

  it("takes a percentage or a flat amount, never more than the total", () => {
    expect(depositFor(10_000, pct)).toBe(2500);
    expect(depositFor(9_995, pct)).toBe(2499); // 2498.75 → 2499
    expect(depositFor(10_000, flat)).toBe(2000);
    expect(depositFor(1_500, flat)).toBe(1500);
    expect(depositFor(0, pct)).toBe(0);
  });

  it("splits into charge-now and balance, or full payment", () => {
    expect(paymentPlan(10_000, pct, false)).toEqual({ chargeNowCents: 2500, balanceDueCents: 7500, paidInFull: false });
    expect(paymentPlan(10_000, pct, true)).toEqual({ chargeNowCents: 10_000, balanceDueCents: 0, paidInFull: true });
  });
});

describe("pickup slots (FUL 02)", () => {
  const settings: PickupSettings = {
    hours: [1, 2, 3, 4].map((weekday) => ({ weekday, open: "11:00", close: "18:00" })).concat([{ weekday: 0, open: "11:00", close: "17:00" }]),
    slotMinutes: 60,
    leadTimeHours: 24,
    daysAhead: 7,
    closedDates: ["2026-10-07"],
  };
  // Monday 2026-10-05 10:00 in Plymouth (EDT, UTC-4).
  const now = new Date("2026-10-05T14:00:00Z");

  it("starts after the lead time and stays inside opening hours", () => {
    const slots = availableSlots(settings, now);
    expect(slots[0]).toEqual({ date: "2026-10-06", start: "11:00", end: "12:00" });
    expect(slots.every((s) => s.start >= "11:00" && s.end <= "18:00")).toBe(true);
    expect(slots.some((s) => s.date === "2026-10-05")).toBe(false);
  });

  it("skips closed dates and days without hours", () => {
    const dates = new Set(availableSlots(settings, now).map((s) => s.date));
    expect(dates.has("2026-10-07")).toBe(false); // closed
    expect(dates.has("2026-10-09")).toBe(false); // Friday: no hours configured here
    expect(dates.has("2026-10-11")).toBe(true); // Sunday
  });

  it("validates a chosen slot and handles daylight saving", () => {
    expect(isAvailableSlot(settings, now, { date: "2026-10-06", start: "11:00" })).not.toBeNull();
    expect(isAvailableSlot(settings, now, { date: "2026-10-06", start: "11:30" })).toBeNull();
    expect(zonedToUtc("2026-11-02", "11:00").toISOString()).toBe("2026-11-02T16:00:00.000Z"); // EST
    expect(zonedToUtc("2026-10-06", "11:00").toISOString()).toBe("2026-10-06T15:00:00.000Z"); // EDT
    expect(formatSlot({ date: "2026-10-06", start: "11:00", end: "12:00" })).toBe("Tuesday, October 6, 11:00 AM–12:00 PM");
  });
});

function product(patch: Partial<Product> = {}): Product {
  return {
    id: 7,
    title: "S'mores Bar",
    slug: "smores",
    category: 1,
    channel: "online",
    priceCents: 425,
    priceApproved: true,
    stockState: "known",
    stockQuantity: 5,
    lowStockThreshold: 3,
    onlineReserve: 1,
    nutFree: "unknown",
    vegan: "unknown",
    updatedAt: "",
    createdAt: "",
    ...patch,
  } as Product;
}

describe("priceCart (D35)", () => {
  const opts = { previewStock: false, taxClasses: [MA, EXEMPT], defaultTaxClassId: "1" };

  it("re-reads prices and clamps to what the website may sell", () => {
    const cart = priceCart([{ unitId: "7", quantity: 9 }], [product()], opts);
    expect(cart.lines[0]).toMatchObject({ quantity: 4, unitPriceCents: 425, lineTotalCents: 1700, problem: { code: "REDUCED" } });
    expect(cart).toMatchObject({ subtotalCents: 1700, taxCents: 106, totalCents: 1806, blocking: false, taxApproved: false });
  });

  it("blocks unavailable lines and never charges them", () => {
    const cart = priceCart([{ unitId: "7", quantity: 1 }], [product({ stockState: "unknown", stockQuantity: null })], opts);
    expect(cart.lines[0].problem).toMatchObject({ code: "UNAVAILABLE", blocking: true });
    expect(cart).toMatchObject({ blocking: true, subtotalCents: 0, payable: [] });
  });

  it("lets staging preview uncounted stock, and uses a product's own tax class", () => {
    const p = product({ stockState: "unknown", stockQuantity: null, taxClass: 2 as never });
    const cart = priceCart([{ unitId: "7", quantity: 2 }], [p], { ...opts, previewStock: true });
    expect(cart).toMatchObject({ blocking: false, subtotalCents: 850, taxCents: 0, taxApproved: true });
  });

  it("prices options separately and drops deleted products", () => {
    const p = product({ variants: [{ key: "pink", label: "Pink", priceCents: 1995, stockState: "known", stockQuantity: 3 }] });
    const cart = priceCart([{ unitId: "7:pink", quantity: 1 }, { unitId: "99", quantity: 1 }], [p], opts);
    expect(cart.lines.map((l) => [l.optionLabel, l.unitPriceCents])).toEqual([["Pink", 1995]]);
  });

  it("refuses unapproved prices", () => {
    expect(priceCart([{ unitId: "7", quantity: 1 }], [product({ priceApproved: false })], opts).blocking).toBe(true);
  });
});

describe("orders and payments", () => {
  it("issues tokens that only match their own hash", () => {
    const { token, hash } = newAccessToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(tokenMatches(token, hash)).toBe(true);
    expect(tokenMatches(token + "x", hash)).toBe(false);
    expect(tokenMatches(undefined, hash)).toBe(false);
  });

  it("numbers records and keys submissions stably", () => {
    expect(formatNumber("SP", 1)).toBe("SP-1001");
    expect(formatNumber("SPR", 42)).toBe("SPR-1042");
    expect(idempotencyKey("cart", [1, 2])).toBe(idempotencyKey("cart", [1, 2]));
    expect(idempotencyKey("cart", [1, 2])).not.toBe(idempotencyKey("cart", [2, 1]));
  });

  it("writes assembly instructions staff can pack from", () => {
    expect(
      assemblyInstructions({
        title: "Sweet basket — Medium",
        basketSizeIn: "14",
        components: [{ productId: "1", name: "Turtles Box", quantity: 1, unitPriceCents: 2795 }],
        message: "Happy birthday!",
        requests: "No nuts please",
      }),
    ).toBe('Sweet basket — Medium — 14" basket\n• 1 × Turtles Box\n\nGift message: "Happy birthday!"\n\nCustomer requests (confirm before packing): No nuts please');
  });

  it("has no payment provider in production, so live ordering stays closed", async () => {
    expect(getPaymentProvider({ APP_ENV: "production" })).toBeNull();
    expect(orderingState(null, true)).toEqual({ open: false, reason: "no_payments" });
    expect(orderingState(testProvider, false)).toEqual({ open: true });
    const a = await testProvider.charge({ reference: "SP-1001", amountCents: 500, idempotencyKey: "k" });
    const b = await testProvider.charge({ reference: "SP-1001", amountCents: 500, idempotencyKey: "k" });
    expect(a).toEqual(b);
    expect(a.status).toBe("paid");
  });
});

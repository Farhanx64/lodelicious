import { describe, expect, it } from "vitest";

import { DEFAULT_BOXES } from "./boxes";
import {
  DEFAULT_SHIPPING,
  basketSizeFromCode,
  basketSizeFromName,
  formatAddress,
  parseAddress,
  productShips,
  quoteShipping,
  rateFor,
  ratesFrom,
  whyNoShipping,
  type ShipItem,
} from "./rates";

const rates = ratesFrom(null);
const regular = (title = "Chocolate bar", shippable = true): ShipItem => ({ title, shippable, kind: "regular" });
const basket = (size: "small" | "medium" | "large" | "larger", shippable = true): ShipItem => ({ title: `${size} basket`, shippable, kind: "basket", size });

describe("shipping rates (D54)", () => {
  it("defaults to $8.95 flat, baskets $10 / $15 / $20 / $25, shipping on", () => {
    expect(rates).toEqual({
      shippingEnabled: true,
      flatRateCents: 895,
      basketSmallCents: 1000,
      basketMediumCents: 1500,
      basketLargeCents: 2000,
      basketLargerCents: 2500,
      chargeByBox: false,
      boxes: DEFAULT_BOXES,
    });
    expect(rates).toEqual({ ...DEFAULT_SHIPPING, boxes: DEFAULT_BOXES });
  });

  it("uses the admin's values and falls back per field on anything malformed", () => {
    expect(ratesFrom({ flatRateCents: 700, basketLargeCents: 2200, basketSmallCents: -5, basketMediumCents: 12.5, shippingEnabled: false })).toEqual({
      ...DEFAULT_SHIPPING,
      boxes: DEFAULT_BOXES,
      flatRateCents: 700,
      basketLargeCents: 2200,
      shippingEnabled: false,
    });
  });

  it("charges each kind of item its own rate", () => {
    expect(rateFor(regular(), rates)).toBe(895);
    expect(rateFor(basket("small"), rates)).toBe(1000);
    expect(rateFor(basket("medium"), rates)).toBe(1500);
    expect(rateFor(basket("large"), rates)).toBe(2000);
    expect(rateFor(basket("larger"), rates)).toBe(2500);
  });

  it("charges one rate for many regular products, never per item", () => {
    expect(quoteShipping([regular("a"), regular("b"), regular("c")], rates)).toMatchObject({ available: true, chargedBy: "rules", cents: 895 });
  });

  it("a mixed cart pays only the highest single applicable rate, never the sum", () => {
    expect(quoteShipping([regular(), basket("small")], rates)).toMatchObject({ available: true, chargedBy: "rules", cents: 1000 });
    expect(quoteShipping([basket("small"), regular(), basket("large"), basket("medium")], rates)).toMatchObject({ available: true, chargedBy: "rules", cents: 2000 });
    expect(quoteShipping([basket("larger"), basket("small"), regular()], rates)).toMatchObject({ available: true, chargedBy: "rules", cents: 2500 });
    // A flat rate set above a basket rate still wins when it is the highest.
    expect(quoteShipping([regular(), basket("small")], { ...rates, flatRateCents: 1200 })).toMatchObject({ available: true, chargedBy: "rules", cents: 1200 });
  });

  it("can't ship when any item can't, and names those items once", () => {
    const quote = quoteShipping([regular("Truffles", false), regular("Bar"), regular("Truffles", false)], rates);
    expect(quote).toEqual({ available: false, reason: "not_shippable", blockers: ["Truffles"] });
    if (quote.available) throw new Error("expected pickup only");
    expect(whyNoShipping(quote)).toBe("Pickup only: Truffles can't be shipped.");
  });

  it("offers pickup only when shipping is switched off or the order is empty", () => {
    expect(quoteShipping([regular()], { ...rates, shippingEnabled: false })).toMatchObject({ available: false, reason: "disabled" });
    expect(quoteShipping([], rates)).toMatchObject({ available: false, reason: "empty" });
  });

  it("ships a product only when ticked Can ship and not perishable", () => {
    expect(productShips({ shippable: true, perishable: false })).toBe(true);
    expect(productShips({ shippable: true, perishable: true })).toBe(false);
    expect(productShips({ shippable: false, perishable: false })).toBe(false);
    expect(productShips({})).toBe(false);
  });
});

describe("basket sizes for shipping", () => {
  it("maps the Build a Basket size codes; anything bigger than large is the larger rate", () => {
    expect(["small", "medium", "large", "extra_large", "xxl", null].map(basketSizeFromCode)).toEqual(["small", "medium", "large", "larger", "larger", "larger"]);
  });

  it("reads a ready-made basket's size from its name or slug, checking extra large before large", () => {
    expect(basketSizeFromName("small-gift-basket")).toBe("small");
    expect(basketSizeFromName("Medium Sympathy Basket")).toBe("medium");
    expect(basketSizeFromName("large-birthday-basket")).toBe("large");
    expect(basketSizeFromName("extra-large-gift-basket")).toBe("larger");
    expect(basketSizeFromName("Extra Large Gift Basket")).toBe("larger");
    // No size word: never ship for less than it may cost.
    expect(basketSizeFromName("Cowboy basket")).toBe("larger");
    expect(basketSizeFromName("smallish basket")).toBe("larger");
  });
});

describe("ship-to address", () => {
  const good = { shipLine1: "1 Main St", shipCity: "Boston", shipState: "ma", shipZip: "02108" };
  it("accepts a US address, upper-cases the state and uses the customer's name by default", () => {
    expect(parseAddress(good, "Pat")).toEqual({ ok: true, address: { name: "Pat", line1: "1 Main St", line2: "", city: "Boston", state: "MA", zip: "02108" } });
    expect(parseAddress({ ...good, shipName: "Sam", shipZip: "02108-1234" }, "Pat")).toMatchObject({ ok: true, address: { name: "Sam", zip: "02108-1234" } });
  });
  it("says what is missing or wrong", () => {
    expect(parseAddress({ ...good, shipLine1: " " }, "Pat")).toMatchObject({ ok: false, error: expect.stringMatching(/street/) });
    expect(parseAddress({ ...good, shipCity: "" }, "Pat")).toMatchObject({ ok: false, error: expect.stringMatching(/town or city/) });
    expect(parseAddress({ ...good, shipState: "ZZ" }, "Pat")).toMatchObject({ ok: false, error: expect.stringMatching(/state/) });
    expect(parseAddress({ ...good, shipZip: "2108" }, "Pat")).toMatchObject({ ok: false, error: expect.stringMatching(/ZIP/) });
  });
  it("strips line breaks so an address can't break a header or a log line", () => {
    const r = parseAddress({ ...good, shipLine1: "1 Main St\r\nBcc: x" }, "Pat");
    expect(r).toMatchObject({ ok: true, address: { line1: "1 Main St Bcc: x" } });
    if (r.ok) expect(formatAddress(r.address)).toBe("Pat, 1 Main St Bcc: x, Boston, MA 02108");
  });
});

describe("charging by box (D60)", () => {
  const weighed = (title: string, weightLbs: number | null, quantity = 1): ShipItem => ({ title, shippable: true, kind: "regular", weightLbs, quantity });
  const byBox = { ...rates, chargeByBox: true };

  it("is off by default: the box is picked for staff but the D54 rate is charged", () => {
    expect(quoteShipping([weighed("Bar", 1)], rates)).toEqual({ available: true, cents: 895, chargedBy: "rules", packing: { box: DEFAULT_BOXES[0], weightLbs: 1 } });
  });

  it("when on, charges the smallest box that holds quantity × weight", () => {
    expect(quoteShipping([weighed("Bar", 1)], byBox)).toMatchObject({ cents: 1000, chargedBy: "box", packing: { box: { name: "Small box" } } });
    expect(quoteShipping([weighed("Bar", 1.5, 3)], byBox)).toMatchObject({ cents: 2000, chargedBy: "box", packing: { box: { name: "Large box" }, weightLbs: 4.5 } });
    const mixed = quoteShipping([weighed("Bar", 1), { ...basket("large"), weightLbs: 5.5 }], byBox);
    expect(mixed).toMatchObject({ cents: 2500, chargedBy: "box", packing: { box: { name: "Extra large box" }, weightLbs: 6.5 } });
    // Lody's own price, once she edits it.
    expect(quoteShipping([weighed("Bar", 1)], { ...byBox, boxes: [{ ...DEFAULT_BOXES[0], priceCents: 795 }] })).toMatchObject({ cents: 795 });
  });

  it("falls back to the D54 rules exactly when an item has no weight, the order is too heavy, or there are no boxes", () => {
    const cart = [regular("Truffles"), weighed("Bar", 1), basket("medium")];
    expect(quoteShipping(cart, byBox)).toEqual({ ...quoteShipping(cart, rates), packing: { box: null, reason: "missing_weight", missing: ["Truffles", "medium basket"] } });
    expect(quoteShipping(cart, byBox)).toMatchObject({ cents: 1500, chargedBy: "rules" });
    expect(quoteShipping([weighed("Anvil", 7.5)], byBox)).toMatchObject({ cents: 895, chargedBy: "rules", packing: { reason: "too_heavy" } });
    expect(quoteShipping([weighed("Bar", 1)], { ...byBox, boxes: [] })).toMatchObject({ cents: 895, chargedBy: "rules", packing: { reason: "no_boxes" } });
  });

  it("never changes who can ship", () => {
    expect(quoteShipping([{ ...weighed("Truffles", 1), shippable: false }], byBox)).toMatchObject({ available: false, reason: "not_shippable" });
    expect(quoteShipping([weighed("Bar", 1)], { ...byBox, shippingEnabled: false })).toMatchObject({ available: false, reason: "disabled" });
  });

  it("reads the switch and the boxes from the settings row", () => {
    expect(ratesFrom({ chargeByBox: true }).chargeByBox).toBe(true);
    expect(ratesFrom({ chargeByBox: "yes" }).chargeByBox).toBe(false);
    // A row never saved: Lody's boxes. A saved row keeps what staff left, even an empty list.
    expect(ratesFrom({ boxes: [] }).boxes).toEqual(DEFAULT_BOXES);
    expect(ratesFrom({ updatedAt: "2026-11-13T00:00:00.000Z", boxes: [] }).boxes).toEqual([]);
    expect(ratesFrom({ updatedAt: "2026-11-13T00:00:00.000Z", boxes: [{ name: "Only", maxWeightLbs: 10, priceCents: 1800 }] }).boxes).toEqual([
      { name: "Only", lengthIn: 0, widthIn: 0, heightIn: 0, maxWeightLbs: 10, priceCents: 1800 },
    ]);
  });
});

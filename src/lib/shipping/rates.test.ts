import { describe, expect, it } from "vitest";

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
    expect(rates).toEqual({ shippingEnabled: true, flatRateCents: 895, basketSmallCents: 1000, basketMediumCents: 1500, basketLargeCents: 2000, basketLargerCents: 2500 });
    expect(rates).toEqual({ ...DEFAULT_SHIPPING });
  });

  it("uses the admin's values and falls back per field on anything malformed", () => {
    expect(ratesFrom({ flatRateCents: 700, basketLargeCents: 2200, basketSmallCents: -5, basketMediumCents: 12.5, shippingEnabled: false })).toEqual({
      ...DEFAULT_SHIPPING,
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
    expect(quoteShipping([regular("a"), regular("b"), regular("c")], rates)).toEqual({ available: true, cents: 895 });
  });

  it("a mixed cart pays only the highest single applicable rate, never the sum", () => {
    expect(quoteShipping([regular(), basket("small")], rates)).toEqual({ available: true, cents: 1000 });
    expect(quoteShipping([basket("small"), regular(), basket("large"), basket("medium")], rates)).toEqual({ available: true, cents: 2000 });
    expect(quoteShipping([basket("larger"), basket("small"), regular()], rates)).toEqual({ available: true, cents: 2500 });
    // A flat rate set above a basket rate still wins when it is the highest.
    expect(quoteShipping([regular(), basket("small")], { ...rates, flatRateCents: 1200 })).toEqual({ available: true, cents: 1200 });
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

import { describe, expect, it } from "vitest";

import type { Product } from "@/payload-types";

import { PRICE_ON_REQUEST, PRICE_TO_BE_CONFIRMED, formatPrice, priceLabel, priceRange, productAvailability, sellableUnits, toBuilderProducts, unitPriceLabel } from "./product";

function product(patch: Partial<Product> = {}): Product {
  return {
    id: 7,
    title: "Baby Ceramic Shoes",
    slug: "baby-ceramic-shoes",
    category: { id: 1, name: "Baby gifts", slug: "baby-gifts", updatedAt: "", createdAt: "" },
    channel: "online",
    priceCents: 1995,
    priceApproved: true,
    stockState: "known",
    stockQuantity: 5,
    lowStockThreshold: 3,
    basketEligible: true,
    giftTypes: ["sweet"],
    premium: false,
    maxPerGift: 1,
    fitUnits: 1,
    nutFree: "unknown",
    vegan: "unknown",
    updatedAt: "",
    createdAt: "",
    ...patch,
  } as Product;
}

describe("sellableUnits", () => {
  it("is the product itself when there are no options", () => {
    expect(sellableUnits(product()).map((u) => u.id)).toEqual(["7"]);
  });

  it("is one unit per option, each with its own stock and optional price", () => {
    const p = product({
      variants: [
        { key: "pink", label: "Pink", stockState: "known", stockQuantity: 4 },
        { key: "blue", label: "Blue", stockState: "unknown", priceCents: 2195 },
      ],
    });
    const units = sellableUnits(p);
    expect(units.map((u) => [u.id, u.name, u.priceCents, u.availability.status])).toEqual([
      ["7:pink", "Baby Ceramic Shoes — Pink", 1995, "available"],
      ["7:blue", "Baby Ceramic Shoes — Blue", 2195, "unavailable"],
    ]);
    expect(productAvailability(p).purchasable).toBe(true);
    expect(priceRange(p)).toEqual({ min: 1995, max: 2195 });
  });

  it("is unavailable when every option's stock is unknown", () => {
    const p = product({ variants: [{ key: "pink", label: "Pink", stockState: "unknown" }] });
    expect(productAvailability(p)).toMatchObject({ purchasable: false, label: "Currently unavailable" });
  });
});

describe("price display (A06)", () => {
  const options = [
    { key: "pink", label: "Pink", stockState: "known" as const, stockQuantity: 4 },
    { key: "blue", label: "Blue", stockState: "unknown" as const, priceCents: 2195 },
  ];

  it("formats an approved price, 'From' when options differ", () => {
    expect(formatPrice(product())).toBe("$19.95");
    expect(formatPrice(product({ variants: options }))).toBe("From $19.95");
    expect(priceLabel(product())).toBe("$19.95");
  });

  it("never shows an unapproved price: no range, no number, 'Price to be confirmed'", () => {
    const unapproved = product({ priceApproved: false, variants: options });
    expect(priceRange(unapproved)).toBeNull();
    expect(formatPrice(unapproved)).toBe(PRICE_TO_BE_CONFIRMED);
    expect(priceLabel(unapproved)).toBe("Price to be confirmed");
    for (const unit of sellableUnits(unapproved)) expect(unitPriceLabel(unapproved, unit)).toBe(PRICE_TO_BE_CONFIRMED);
    expect(`${formatPrice(unapproved)} ${priceLabel(unapproved)}`).not.toMatch(/\d/);
  });

  it("shows each option's own price when approved, and nothing for an option with no price", () => {
    const p = product({ variants: options });
    expect(sellableUnits(p).map((u) => unitPriceLabel(p, u))).toEqual(["$19.95", "$21.95"]);
    expect(unitPriceLabel(product({ priceCents: null }), { priceCents: null })).toBe("");
  });

  it("says 'Price on request' only for an approved product with no price", () => {
    expect(formatPrice(product({ priceCents: null }))).toBeNull();
    expect(priceLabel(product({ priceCents: null }))).toBe(PRICE_ON_REQUEST);
    expect(priceLabel(product({ priceCents: null, priceApproved: false }))).toBe(PRICE_TO_BE_CONFIRMED);
  });
});

describe("toBuilderProducts", () => {
  it("maps admin fields to the gift engine, per option", () => {
    const p = product({
      premium: true,
      exclusiveTo: "baby_white",
      variants: [{ key: "pink", label: "Pink", stockState: "known", stockQuantity: 2 }],
    });
    expect(toBuilderProducts(p)).toEqual([
      {
        id: "7:pink",
        name: "Baby Ceramic Shoes — Pink",
        priceCents: 1995,
        priceApproved: true,
        stock: { state: "known", quantity: 2 },
        premium: true,
        giftTypes: ["sweet"],
        basketEligible: true,
        category: "baby-gifts",
        channel: "online",
        exclusiveTo: "baby_white",
        maxPerGift: 1,
        fitUnits: 1,
      },
    ]);
  });

  it("gives the gift engine only the stock above the in-store reserve, per option", () => {
    const p = product({
      onlineReserve: 2,
      variants: [
        { key: "pink", label: "Pink", stockState: "known", stockQuantity: 5 },
        { key: "blue", label: "Blue", stockState: "known", stockQuantity: 1 },
      ],
    });
    expect(toBuilderProducts(p).map((u) => u.stock)).toEqual([
      { state: "known", quantity: 3 },
      { state: "known", quantity: 0 },
    ]);
    expect(sellableUnits(p).map((u) => u.availability.purchasable)).toEqual([true, false]);
  });

  it("treats a counted product without a quantity as unknown stock", () => {
    expect(toBuilderProducts(product({ stockQuantity: null }))[0].stock).toEqual({ state: "unknown" });
  });
});

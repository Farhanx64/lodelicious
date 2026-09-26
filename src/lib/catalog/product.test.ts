import { describe, expect, it } from "vitest";

import type { Product } from "@/payload-types";

import { priceRange, productAvailability, sellableUnits, toBuilderProducts } from "./product";

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

  it("treats a counted product without a quantity as unknown stock", () => {
    expect(toBuilderProducts(product({ stockQuantity: null }))[0].stock).toEqual({ state: "unknown" });
  });
});

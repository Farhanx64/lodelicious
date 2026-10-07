import { describe, expect, it } from "vitest";

import { bomOf, mergePlan, parseUnitId, planFor, unitKey } from "./units";

describe("units", () => {
  it("round-trips a product and an option", () => {
    expect(parseUnitId("12")).toEqual({ productId: "12", variantKey: null });
    expect(parseUnitId("12:pink")).toEqual({ productId: "12", variantKey: "pink" });
    expect(unitKey({ productId: "12", variantKey: "pink" })).toBe("12:pink");
    expect(unitKey({ productId: "12", variantKey: null })).toBe("12");
  });
});

describe("mergePlan", () => {
  it("adds repeated units, drops zero, negative and fractional quantities, and sorts", () => {
    const merged = mergePlan([
      { productId: "9", variantKey: null, quantity: 2 },
      { productId: "3", variantKey: "blue", quantity: 1 },
      { productId: "9", variantKey: null, quantity: 3 },
      { productId: "4", variantKey: null, quantity: 0 },
      { productId: "5", variantKey: null, quantity: -1 },
      { productId: "6", variantKey: null, quantity: 1.5 },
    ]);
    expect(merged).toEqual([
      { productId: "3", variantKey: "blue", quantity: 1 },
      { productId: "9", variantKey: null, quantity: 5 },
    ]);
  });
});

describe("bomOf", () => {
  it("reads components whether the product is an id or populated, and ignores bad rows", () => {
    expect(
      bomOf({
        components: [
          { product: 4, variantKey: null, quantity: 2 },
          { product: { id: 5 }, variantKey: "pink", quantity: 1 },
          { product: 6, quantity: 0 },
          { product: null, quantity: 1 },
          { product: 7, quantity: 1.5 },
        ],
      }),
    ).toEqual([
      { productId: "4", variantKey: null, quantity: 2 },
      { productId: "5", variantKey: "pink", quantity: 1 },
    ]);
    expect(bomOf({ components: [] })).toEqual([]);
    expect(bomOf(undefined)).toEqual([]);
  });
});

describe("planFor (INV 01: each component once, never the basket and its parts)", () => {
  const basket = { id: "100", parts: [{ productId: "1", variantKey: null, quantity: 3 }, { productId: "2", variantKey: "ribbon", quantity: 1 }] };
  const components = (id: string) => (id === basket.id ? basket.parts : []);

  it("deducts a plain product from itself", () => {
    expect(planFor([{ unitId: "7:pink", quantity: 2 }], components)).toEqual([{ productId: "7", variantKey: "pink", quantity: 2 }]);
  });

  it("deducts a basket with contents from its components only, scaled by quantity", () => {
    expect(planFor([{ unitId: "100", quantity: 2 }], components)).toEqual([
      { productId: "1", variantKey: null, quantity: 6 },
      { productId: "2", variantKey: "ribbon", quantity: 2 },
    ]);
  });

  it("adds a component bought on its own to what a basket takes, as one line", () => {
    expect(
      planFor(
        [
          { unitId: "100", quantity: 1 },
          { unitId: "1", quantity: 2 },
        ],
        components,
      ),
    ).toEqual([
      { productId: "1", variantKey: null, quantity: 5 },
      { productId: "2", variantKey: "ribbon", quantity: 1 },
    ]);
  });
});

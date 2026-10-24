import { describe, expect, it } from "vitest";

import { parseCustomRequest } from "./request";

const ok = { kind: "custom", size: "large", giftType: "sympathy", budgetCents: 10000, selections: [{ productId: "12", quantity: 1 }] };

describe("parseCustomRequest", () => {
  it("accepts a well-formed request", () => {
    expect(parseCustomRequest(ok)).toEqual(ok);
    expect(parseCustomRequest({ ...ok, budgetCents: null })?.budgetCents).toBeNull();
    expect(parseCustomRequest({ ...ok, budgetCents: undefined })?.budgetCents).toBeNull();
  });

  it.each([
    ["not an object", "x"],
    ["special presentation", { ...ok, kind: "special" }],
    ["unknown size", { ...ok, size: "huge" }],
    ["unknown gift type", { ...ok, giftType: "birthday" }],
    ["fractional budget", { ...ok, budgetCents: 99.5 }],
    ["negative budget", { ...ok, budgetCents: -1 }],
    ["absurd budget", { ...ok, budgetCents: 1e12 }],
    ["selections not a list", { ...ok, selections: "12" }],
    ["too many selections", { ...ok, selections: Array.from({ length: 101 }, (_, i) => ({ productId: String(i), quantity: 1 })) }],
  ])("rejects %s", (_label, input) => {
    expect(parseCustomRequest(input)).toBeNull();
  });

  it("accepts a quantity sent as a whole-number string, and ids sent as numbers", () => {
    expect(parseCustomRequest({ ...ok, selections: [{ productId: 12, quantity: "2" }] })?.selections).toEqual([{ productId: "12", quantity: 2 }]);
  });

  // A01: [{P,3},{P,-2}] used to validate as one P and be priced and packed as three.
  it.each([
    ["negative", -2],
    ["zero", 0],
    ["fractional", 2.5],
    ["fractional string", "2.5"],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["not a number", "many"],
    ["missing", undefined],
    ["absurdly large", 1e15],
  ])("rejects a %s quantity", (_label, quantity) => {
    expect(parseCustomRequest({ ...ok, selections: [{ productId: "12", quantity }] })).toBeNull();
    // ... also when it hides next to a valid line, as in the crafted request.
    expect(parseCustomRequest({ ...ok, selections: [{ productId: "7", quantity: 1 }, { productId: "12", quantity }] })).toBeNull();
  });

  it("rejects the crafted negative-plus-positive pair for the same product", () => {
    expect(parseCustomRequest({ ...ok, selections: [{ productId: "12", quantity: 3 }, { productId: "12", quantity: -2 }] })).toBeNull();
  });

  it("rejects a selection with no product id", () => {
    expect(parseCustomRequest({ ...ok, selections: [{ quantity: 1 }] })).toBeNull();
    expect(parseCustomRequest({ ...ok, selections: [{ productId: "", quantity: 1 }] })).toBeNull();
  });

  it("merges a product listed twice into one line, in first-seen order", () => {
    const parsed = parseCustomRequest({
      ...ok,
      selections: [
        { productId: "12", quantity: 1 },
        { productId: "7", quantity: 2 },
        { productId: 12, quantity: 2 },
      ],
    });
    expect(parsed?.selections).toEqual([
      { productId: "12", quantity: 3 },
      { productId: "7", quantity: 2 },
    ]);
  });

  it("rejects duplicates that add up past the per-line cap", () => {
    expect(parseCustomRequest({ ...ok, selections: [{ productId: "12", quantity: 60 }, { productId: "12", quantity: 60 }] })).toBeNull();
  });
});

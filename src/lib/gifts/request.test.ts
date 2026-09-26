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

  it("leaves quantity checks to validateGift instead of silently fixing them", () => {
    expect(parseCustomRequest({ ...ok, selections: [{ productId: 12, quantity: "2.5" }] })?.selections).toEqual([{ productId: "12", quantity: 2.5 }]);
  });
});

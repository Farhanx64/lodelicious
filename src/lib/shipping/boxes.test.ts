import { describe, expect, it } from "vitest";

import { DEFAULT_BOXES, boxLabel, boxesFrom, orderWeight, packingNote, packingWeight, pickBox, validWeight, type WeighedItem } from "./boxes";

const boxes = boxesFrom(undefined);
const item = (title: string, weightLbs: number | null, quantity = 1): WeighedItem => ({ title, weightLbs, quantity });
const boxName = (items: WeighedItem[]) => {
  const p = pickBox(items, boxes);
  return p.box ? p.box.name : p.reason;
};

describe("Lody's boxes (D60)", () => {
  it("prefills her four boxes, priced at the D54 basket rates for the same size", () => {
    expect(boxes).toEqual([
      { name: "Small box", lengthIn: 14, widthIn: 9, heightIn: 14, maxWeightLbs: 3, priceCents: 1000 },
      { name: "Medium box", lengthIn: 16, widthIn: 10, heightIn: 16, maxWeightLbs: 4, priceCents: 1500 },
      { name: "Large box", lengthIn: 18, widthIn: 12, heightIn: 20, maxWeightLbs: 6, priceCents: 2000 },
      { name: "Extra large box", lengthIn: 22, widthIn: 22, heightIn: 18, maxWeightLbs: 7, priceCents: 2500 },
    ]);
    // A copy: editing the result never changes the defaults.
    boxes[0].priceCents = 1;
    expect(DEFAULT_BOXES[0].priceCents).toBe(1000);
    boxes[0].priceCents = 1000;
  });

  it("uses the admin's list as saved, skipping unusable rows; an empty list means no boxes", () => {
    expect(boxesFrom([])).toEqual([]);
    expect(boxesFrom(null)).toEqual([]);
    expect(
      boxesFrom([
        { name: " Tiny ", maxWeightLbs: 1.5, priceCents: 700, lengthIn: 8, widthIn: 6, heightIn: null },
        { name: "", maxWeightLbs: 2, priceCents: 800 },
        { name: "No weight", maxWeightLbs: 0, priceCents: 800 },
        { name: "Bad price", maxWeightLbs: 2, priceCents: 8.5 },
      ]),
    ).toEqual([{ name: "Tiny", lengthIn: 8, widthIn: 6, heightIn: 0, maxWeightLbs: 1.5, priceCents: 700 }]);
  });
});

describe("order weight", () => {
  it("adds quantity × weight, in exact hundredths", () => {
    expect(orderWeight([item("Bar", 0.1, 3), item("Box", 0.2)])).toEqual({ ok: true, weightLbs: 0.5 });
    expect(orderWeight([item("Fudge", 1.25, 2)])).toEqual({ ok: true, weightLbs: 2.5 });
  });

  it("names (once) every item without a usable weight", () => {
    expect(orderWeight([item("Truffles", null), item("Bar", 1), item("Truffles", null), { title: "Mug", quantity: 1, weightLbs: undefined }, item("Zero", 0)])).toEqual({
      ok: false,
      missing: ["Truffles", "Mug", "Zero"],
    });
    expect([1.5, 0, -1, Number.NaN, "2", null].map(validWeight)).toEqual([1.5, null, null, null, null, null]);
  });
});

describe("picking the box", () => {
  it("picks the smallest box whose maximum holds the order", () => {
    expect(boxName([item("Bar", 0.5)])).toBe("Small box");
    expect(boxName([item("Bar", 1, 3)])).toBe("Small box"); // exactly 3 lbs still fits
    expect(boxName([item("Bar", 1, 3), item("Mint", 0.01)])).toBe("Medium box");
    expect(boxName([item("Basket", 4.5)])).toBe("Large box");
    expect(boxName([item("Basket", 5), item("Bar", 0.75, 2)])).toBe("Extra large box");
  });

  it("orders boxes by maximum weight whatever order staff list them in; equal maximums take the cheaper", () => {
    const shuffled = [boxes[3], boxes[1], boxes[0], boxes[2]];
    expect(pickBox([item("Bar", 3.5)], shuffled)).toMatchObject({ box: { name: "Medium box" }, weightLbs: 3.5 });
    const twins = [{ ...boxes[0], name: "Dear", priceCents: 1200 }, { ...boxes[0], name: "Cheap", priceCents: 900 }];
    expect(pickBox([item("Bar", 1)], twins)).toMatchObject({ box: { name: "Cheap" } });
  });

  it("picks no box when an item has no weight, the order is too heavy, or there are no boxes", () => {
    expect(pickBox([item("Bar", 1), item("Truffles", null)], boxes)).toEqual({ box: null, reason: "missing_weight", missing: ["Truffles"] });
    expect(pickBox([item("Basket", 7.01)], boxes)).toEqual({ box: null, reason: "too_heavy", weightLbs: 7.01, heaviestLbs: 7 });
    expect(pickBox([item("Bar", 1)], [])).toEqual({ box: null, reason: "no_boxes" });
  });
});

describe("what staff read on the order", () => {
  it("names the box and its size, or says why to choose one by hand", () => {
    expect(packingNote(pickBox([item("Bar", 2)], boxes))).toBe("Small box, 14 × 9 × 14 in");
    expect(boxLabel({ ...boxes[0], heightIn: 0 })).toBe("Small box");
    expect(packingNote(pickBox([item("Truffles", null), item("Mug", null)], boxes))).toBe("Choose a box by hand: no shipping weight for Truffles, Mug");
    expect(packingNote(pickBox([item("Basket", 4, 2)], boxes))).toBe("Choose a box by hand: 8 lbs is over the largest box (7 lbs)");
    expect(packingNote(pickBox([item("Bar", 1)], []))).toBe("Choose a box by hand: no boxes are set up");
  });

  it("records the weight whenever every item had one", () => {
    expect(packingWeight(pickBox([item("Bar", 2.25)], boxes))).toBe(2.25);
    expect(packingWeight(pickBox([item("Basket", 9)], boxes))).toBe(9);
    expect(packingWeight(pickBox([item("Bar", null)], boxes))).toBeNull();
  });
});

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseCsvRecords } from "../csv";

import { DEFAULT_GIFT_SETTINGS, GiftSettingsError, parseSettings } from "./defaults";
import { resolveCountRange } from "./rules";

describe("defaults", () => {
  it("match the PRD packaging fees and premium caps", () => {
    expect(DEFAULT_GIFT_SETTINGS.sizes.map((s) => [s.code, s.packagingCents, s.premiumCap])).toEqual([
      ["small", 1995, 1],
      ["medium", 2495, 2],
      ["large", 2995, 3],
      ["extra_large", 3795, 4],
    ]);
  });

  it("match the owner's basket chart counts", () => {
    const chart = parseCsvRecords(fs.readFileSync(path.resolve("data/source/basket-chart.csv"), "utf8"));
    const expect_ = (code: string) => {
      const row = chart.find((r) => r.code === code)!;
      return { min: Number(row.min_items), max: Number(row.max_items) };
    };
    expect(resolveCountRange(DEFAULT_GIFT_SETTINGS, "small", "sweet")).toEqual(expect_("small"));
    expect(resolveCountRange(DEFAULT_GIFT_SETTINGS, "medium", "sweet")).toEqual(expect_("medium"));
    expect(resolveCountRange(DEFAULT_GIFT_SETTINGS, "large", "sweet")).toEqual(expect_("large"));
    expect(resolveCountRange(DEFAULT_GIFT_SETTINGS, "extra_large", "sweet")).toEqual(expect_("extra_large"));
    expect(resolveCountRange(DEFAULT_GIFT_SETTINGS, "small", "sympathy")).toEqual(expect_("small_sympathy"));
    expect(resolveCountRange(DEFAULT_GIFT_SETTINGS, "medium", "sympathy")).toEqual(expect_("medium_sympathy"));
    expect(resolveCountRange(DEFAULT_GIFT_SETTINGS, "large", "sympathy")).toEqual(expect_("large_sympathy"));
  });

  it("keep unpriced special presentations out of direct purchase", () => {
    for (const p of DEFAULT_GIFT_SETTINGS.specialPresentations) {
      expect(p.status).not.toBe("available");
      expect(p.basePriceCents).toBeNull();
    }
  });
});

describe("parseSettings", () => {
  const doc = () => JSON.parse(JSON.stringify(DEFAULT_GIFT_SETTINGS)) as Record<string, unknown> & typeof DEFAULT_GIFT_SETTINGS;

  it("round-trips the defaults", () => {
    expect(parseSettings(doc())).toEqual(DEFAULT_GIFT_SETTINGS);
  });

  it("accepts Payload's array rows for text lists", () => {
    const d = doc() as unknown as Record<string, Record<string, unknown>[]>;
    d.specialPresentations[1].allowedCategories = [{ value: "candy", id: "a" }, { value: "chocolate", id: "b" }];
    expect(parseSettings(d).specialPresentations[1].allowedCategories).toEqual(["candy", "chocolate"]);
  });

  it.each([
    ["min above max", (d: ReturnType<typeof doc>) => { d.sizes[0].minItems = 9; }, /minimum \(9\) is above maximum \(8\)/],
    ["fractional packaging", (d: ReturnType<typeof doc>) => { d.sizes[0].packagingCents = 19.95; }, /packaging must be a whole number/],
    ["negative cap", (d: ReturnType<typeof doc>) => { d.sizes[1].premiumCap = -1; }, /premium maximum must be a whole number/],
    ["duplicate size", (d: ReturnType<typeof doc>) => { d.sizes[1].code = "small"; }, /only once/],
    ["unknown gift type", (d: ReturnType<typeof doc>) => { (d.countOverrides[0] as { giftType: string }).giftType = "birthday"; }, /gift type must be one of/],
    ["available without a price", (d: ReturnType<typeof doc>) => { d.specialPresentations[0].status = "available"; }, /set a price and premium maximum/],
  ])("rejects %s", (_label, mutate, message) => {
    const d = doc();
    mutate(d);
    expect(() => parseSettings(d)).toThrow(GiftSettingsError);
    expect(() => parseSettings(d)).toThrow(message);
  });
});

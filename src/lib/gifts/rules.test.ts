import { describe, expect, it } from "vitest";

import { DEFAULT_GIFT_SETTINGS as settings } from "./defaults";
import { packagingFor, resolveCountRange } from "./rules";

describe("packagingFor (AC 03)", () => {
  it("charges the size fee only for custom baskets", () => {
    expect(packagingFor(settings, "custom", "medium")).toBe(2495);
  });

  it("never charges packaging on curated baskets or special presentations (price already includes it)", () => {
    expect(packagingFor(settings, "curated", "large")).toBe(0);
    expect(packagingFor(settings, "curated")).toBe(0);
    expect(packagingFor(settings, "special")).toBe(0);
  });

  it("requires a size for custom baskets", () => {
    expect(() => packagingFor(settings, "custom")).toThrow(RangeError);
  });
});

describe("resolveCountRange", () => {
  it("applies the large sympathy override only to that combination", () => {
    expect(resolveCountRange(settings, "large", "sympathy")).toEqual({ min: 13, max: 16 });
    expect(resolveCountRange(settings, "large", "sweet_savory")).toEqual({ min: 12, max: 14 });
    expect(resolveCountRange(settings, "extra_large", "sympathy")).toEqual({ min: 18, max: 20 });
  });
});

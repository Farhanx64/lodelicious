import { describe, expect, it } from "vitest";

import { BRAND_COLOR_DEFAULT, BUTTON_COLOR_DEFAULT, brandColor, buttonColor, validateBrandColor, validateButtonColor } from "./brand-color";

describe("brand colour setting", () => {
  it("accepts empty, and deep colours that keep white text readable", () => {
    expect(validateBrandColor("")).toBe(true);
    expect(validateBrandColor(null)).toBe(true);
    expect(validateBrandColor("#9c4459")).toBe(true);
    expect(validateBrandColor("#56708A")).toBe(true);
  });

  it("refuses malformed codes and colours too pale for white text", () => {
    expect(validateBrandColor("pink")).toMatch(/colour code/);
    expect(validateBrandColor("#fff")).toMatch(/colour code/);
    expect(validateBrandColor("#f4b6c2")).toMatch(/Too light/);
  });

  it("falls back to the default for anything it would refuse", () => {
    expect(brandColor(undefined)).toBe(BRAND_COLOR_DEFAULT);
    expect(brandColor("#f4b6c2")).toBe(BRAND_COLOR_DEFAULT);
    expect(brandColor(" #A0405A ")).toBe("#a0405a");
  });
});

describe("button colour setting", () => {
  it("accepts light colours that keep dark text readable, and refuses dark ones", () => {
    expect(validateButtonColor("")).toBe(true);
    expect(validateButtonColor("#c8a467")).toBe(true);
    expect(validateButtonColor("#f4b6c2")).toBe(true);
    expect(validateButtonColor("#6b4a1f")).toMatch(/Too dark/);
    expect(buttonColor("#6b4a1f")).toBe(BUTTON_COLOR_DEFAULT);
    expect(buttonColor("#E8C7A0")).toBe("#e8c7a0");
  });
});

/**
 * The admin colour picker (D55): typed Hex/RGB/HSL values, the saved-colour list, and the preset
 * swatches staying in step with the storefront tokens in app/globals.css.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BRAND_COLOR_DEFAULT, BUTTON_COLOR_DEFAULT } from "@/src/lib/brand-color";
import { formatColor, hslToRgb, parseColor, rgbToHex, rgbToHsl } from "@/src/lib/color-format";
import { MAX_SAVED_COLORS, PALETTE_PRESETS, normalizeSavedColors, validateSavedColors } from "@/src/lib/color-palette";

describe("formatColor", () => {
  it("shows a colour as Hex, RGB or HSL", () => {
    expect(formatColor("#9C4459", "hex")).toBe("#9c4459");
    expect(formatColor("#9c4459", "rgb")).toBe("rgb(156, 68, 89)");
    expect(formatColor("#9c4459", "hsl")).toBe("hsl(346, 39%, 44%)");
    expect(formatColor("#ffffff", "hsl")).toBe("hsl(0, 0%, 100%)");
  });
});

describe("parseColor", () => {
  it.each([
    ["#9c4459", "hex", "#9c4459"],
    ["9C4459", "hex", "#9c4459"],
    ["#c45", "hex", "#cc4455"],
    ["  #9c4459 ", "rgb", "#9c4459"],
    ["rgb(156, 68, 89)", "hex", "#9c4459"],
    ["rgb(156 68 89)", "hsl", "#9c4459"],
    ["156, 68, 89", "rgb", "#9c4459"],
    ["hsl(346, 39%, 44%)", "hex", "#9c4459"],
    ["346 39% 44%", "hsl", "#9c4459"],
    ["hsl(0deg 0% 0%)", "hex", "#000000"],
  ] as const)("reads %s (format %s)", (input, format, hex) => {
    expect(parseColor(input, format)).toBe(hex);
  });

  it.each([["", "hex"], ["#12345", "hex"], ["rgb(300, 0, 0)", "hex"], ["hsl(10, 120%, 50%)", "hex"], ["rgba(1,2,3,0.5)", "hex"], ["red", "hex"], ["#9c445980", "hex"]] as const)(
    "refuses %s",
    (input, format) => {
      expect(parseColor(input, format)).toBeNull();
    },
  );

  it("round-trips through HSL closely enough to land on the same swatch", () => {
    for (const { hex } of PALETTE_PRESETS) {
      const back = rgbToHex(hslToRgb(rgbToHsl({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) })));
      expect(back).toBe(hex);
    }
  });
});

describe("saved colours", () => {
  it("stores lowercase #rrggbb, without repeats or junk", () => {
    expect(normalizeSavedColors(["#ABCDEF", "#abcdef", "nope", 4, " #123456 "])).toEqual(["#abcdef", "#123456"]);
    expect(normalizeSavedColors(null)).toEqual([]);
    expect(normalizeSavedColors(Array.from({ length: 40 }, (_, i) => `#0000${i.toString(16).padStart(2, "0")}`))).toHaveLength(MAX_SAVED_COLORS);
  });

  it("validates the stored list", () => {
    expect(validateSavedColors(["#9c4459"])).toBe(true);
    expect(validateSavedColors(null)).toBe(true);
    expect(validateSavedColors(["#9c445980"])).not.toBe(true);
    expect(validateSavedColors({ colors: [] })).not.toBe(true);
  });
});

describe("palette presets", () => {
  const css = fs.readFileSync(path.resolve("app/globals.css"), "utf8");
  const tokens = Object.fromEntries([...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]));

  it("match the storefront tokens they are named after", () => {
    for (const p of PALETTE_PRESETS.filter((p) => p.token)) expect([p.token, p.hex]).toEqual([p.token, tokens[p.token!]]);
  });

  it("include both editable defaults and the shop pinks", () => {
    const hexes = PALETTE_PRESETS.map((p) => p.hex);
    for (const hex of [BRAND_COLOR_DEFAULT, BUTTON_COLOR_DEFAULT, "#d58f9c", "#9c4459", "#f8e6e8"]) expect(hexes).toContain(hex);
    expect(new Set(hexes).size).toBe(hexes.length);
  });
});

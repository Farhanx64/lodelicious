/**
 * WCAG 2.2 AA for the storefront palette (D49). Reads the tokens from app/globals.css so a colour
 * tweak there that breaks contrast fails here, not in front of a customer.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.resolve("app/globals.css"), "utf8");
const tokens = Object.fromEntries([...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Where body text sits: the page and the clay cards and panels. */
const SURFACES = ["cream", "clay"];

describe("palette (D49)", () => {
  it("defines every token the checks use", () => {
    for (const name of [...SURFACES, "cocoa", "muted", "line", "rose", "rose-deep", "on-rose", "focus", "error", "success"]) {
      expect(tokens[name], name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps the owner's colours, with muted text and the button rose deepened for AA", () => {
    expect(tokens).toMatchObject({
      cream: "#fbf4f3",
      clay: "#f5e0df",
      cocoa: "#3a2a2e",
      line: "#ecd9d8",
      rose: "#d58f9c",
      "on-rose": "#fdf8f7",
      muted: "#6f5a5f",
      "rose-deep": "#9c4459",
      gold: "#c8a467",
    });

  });

  it.each(["cocoa", "muted", "error", "success", "rose-deep"])("%s text is at least 4.5:1 on every surface (WCAG AA)", (fg) => {
    for (const bg of SURFACES) expect(contrast(tokens[fg], tokens[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it("cocoa labels are AA on the gold buttons", () => {
    expect(contrast(tokens.cocoa, tokens.gold)).toBeGreaterThanOrEqual(4.5);
  });

  it("cream labels are AA on the announcement bar and rose panels", () => {
    expect(contrast(tokens["on-rose"], tokens["rose-deep"])).toBeGreaterThanOrEqual(4.5);
  });

  it("the light rose is too pale for small cream text, so it stays decorative", () => {
    // If this ever passes, the deep variant is no longer needed for buttons.
    expect(contrast(tokens["on-rose"], tokens.rose)).toBeLessThan(4.5);
  });

  it("focus outlines are at least 3:1 against every surface, and the cream ring on rose", () => {
    for (const bg of SURFACES) expect(contrast(tokens.focus, tokens[bg]), `focus on ${bg}`).toBeGreaterThanOrEqual(3);
    expect(contrast(tokens["on-rose"], tokens["rose-deep"])).toBeGreaterThanOrEqual(3);
  });

  it("form field borders (muted) are at least 3:1 against the page and cards (WCAG 1.4.11)", () => {
    for (const bg of SURFACES) expect(contrast(tokens.muted, tokens[bg]), bg).toBeGreaterThanOrEqual(3);
  });
});

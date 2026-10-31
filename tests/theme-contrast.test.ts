/**
 * WCAG 2.2 AA for the storefront palette (D30). Reads the tokens from app/globals.css so a colour
 * tweak there that breaks contrast fails here, not in front of a customer.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.resolve("app/globals.css"), "utf8");
const tokens = Object.fromEntries([...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));

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

const SURFACES = ["cream", "paper", "ivory", "linen", "blush", "coastal-pale"];

describe("palette (Lody's mood board, D31)", () => {
  it("defines every token the checks use", () => {
    for (const name of [...SURFACES, "ink", "ink-soft", "nav", "gold-text", "gold", "coastal", "focus", "error", "success"]) {
      expect(tokens[name], name).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("matches the board colours, with the D48 changes", () => {
    expect(tokens).toMatchObject({
      cream: "#f7f2ee",
      paper: "#ffffff",
      ivory: "#f7f0ea",
      linen: "#eadccf",
      blush: "#efd5ce",
      coastal: "#98a9b9",
      gold: "#b99870",
      "coastal-deep": "#56708a",
      "gold-text": "#735a39",
      nav: "#605b57",
    });
  });

  it.each(["ink", "ink-soft", "error", "success"])("%s text is at least 4.5:1 on every surface (WCAG AA)", (fg) => {
    for (const bg of SURFACES) expect(contrast(tokens[fg], tokens[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the nav lettering AA on the page and nav bar", () => {
    for (const bg of ["cream", "paper"]) expect(contrast(tokens.nav, tokens[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it("focus outlines are at least 3:1 against every surface", () => {
    for (const bg of SURFACES) expect(contrast(tokens.focus, tokens[bg]), `focus on ${bg}`).toBeGreaterThanOrEqual(3);
  });

  it("gold text is AA on the page and on cards (D48 deepened the board gold)", () => {
    for (const bg of ["cream", "paper"]) expect(contrast(tokens["gold-text"], tokens[bg]), bg).toBeGreaterThanOrEqual(4.5);
  });

  it("white button text is AA on the deep coastal blue", () => {
    expect(contrast(tokens["coastal-deep"], tokens.paper)).toBeGreaterThanOrEqual(4.5);
  });
});

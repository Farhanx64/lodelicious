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

const SURFACES = ["cream", "paper", "linen", "blush", "coastal-pale"];

describe("palette contrast (WCAG 2.2 AA)", () => {
  it("defines every token the checks use", () => {
    for (const name of [...SURFACES, "ink", "ink-soft", "gold-text", "gold", "coastal", "focus", "error", "success"]) {
      expect(tokens[name], name).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(["ink", "ink-soft", "gold-text", "error", "success"])("%s text is at least 4.5:1 on every surface", (fg) => {
    for (const bg of SURFACES) expect(contrast(tokens[fg], tokens[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it("button labels (ivory on gold) are at least 4.5:1", () => {
    expect(contrast(tokens.cream, tokens["gold-text"])).toBeGreaterThanOrEqual(4.5);
  });

  it("focus outlines are at least 3:1 against every surface", () => {
    for (const bg of SURFACES) expect(contrast(tokens.focus, tokens[bg]), `focus on ${bg}`).toBeGreaterThanOrEqual(3);
  });

  it("documents why antique gold and coastal blue are never text", () => {
    expect(contrast(tokens.gold, tokens.cream)).toBeLessThan(3);
    expect(contrast(tokens.coastal, tokens.cream)).toBeLessThan(3);
  });

  it("never uses antique gold or coastal blue as a text colour in the storefront", () => {
    const files = ["app", "components"].flatMap((dir) =>
      (fs.readdirSync(path.resolve(dir), { recursive: true }) as string[])
        .filter((f) => f.endsWith(".tsx"))
        .map((f) => path.join(dir, f)),
    );
    const offenders = files.filter((f) => /\btext-(gold|coastal|coastal-pale)(?![\w-])/.test(fs.readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

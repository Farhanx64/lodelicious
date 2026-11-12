import { BRAND_COLOR_DEFAULT, BUTTON_COLOR_DEFAULT } from "./brand-color";

/**
 * The "Saved" swatches in the admin colour picker (D55): the shop's own colours first, then the ones
 * staff add, kept in the Colour palette global so they follow them to any device.
 *
 * The presets are the storefront tokens in `app/globals.css` (D50) plus the two editable defaults;
 * `tests/color-picker.test.ts` keeps them in step with the CSS.
 */
export const PALETTE_PRESETS: readonly { name: string; hex: string; token?: string }[] = [
  { name: "Pink (default brand colour)", hex: BRAND_COLOR_DEFAULT, token: "coastal-deep" },
  { name: "Rose", hex: "#d58f9c", token: "coastal" },
  { name: "Pale pink", hex: "#f8e6e8", token: "coastal-pale" },
  { name: "Blush", hex: "#efd5ce", token: "blush" },
  { name: "Gold (default button colour)", hex: BUTTON_COLOR_DEFAULT },
  { name: "Bow gold", hex: "#b99870", token: "gold" },
  { name: "Gold text", hex: "#735a39", token: "gold-text" },
  { name: "Ink", hex: "#3b2f25", token: "ink" },
  { name: "Cream", hex: "#f7f2ee", token: "cream" },
];

export const MAX_SAVED_COLORS = 24;
const HEX = /^#[0-9a-f]{6}$/;

/** The saved list as stored: lowercase `#rrggbb`, no repeats, at most MAX_SAVED_COLORS. */
export function normalizeSavedColors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    const hex = typeof v === "string" ? v.trim().toLowerCase() : "";
    if (HEX.test(hex) && !out.includes(hex)) out.push(hex);
  }
  return out.slice(0, MAX_SAVED_COLORS);
}

/** Payload validation for the global's JSON field. */
export function validateSavedColors(value: unknown): true | string {
  if (value == null) return true;
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !HEX.test(v.trim().toLowerCase())))
    return "A list of colour codes like #9c4459.";
  if (value.length > MAX_SAVED_COLORS) return `Up to ${MAX_SAVED_COLORS} saved colours.`;
  return true;
}

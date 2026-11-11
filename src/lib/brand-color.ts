/**
 * Colours staff can change under Website → Store details. Each one sits behind text, so a colour
 * is accepted only when that text stays readable on it (WCAG AA, 4.5:1).
 *  - Brand colour: the main pink (announcement bar, panels), with near-white text on it.
 *  - Button colour: the filled buttons (gold by default), with dark text on it.
 */
export const BRAND_COLOR_DEFAULT = "#9c4459";
export const BUTTON_COLOR_DEFAULT = "#c8a467";
const LIGHT_TEXT = "#fdf8f7";
const DARK_TEXT = "#3a2a2e";
const HEX = /^#[0-9a-f]{6}$/i;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function check(value: unknown, text: string, tooWhat: string, example: string): true | string {
  if (value == null || value === "") return true;
  if (typeof value !== "string" || !HEX.test(value.trim())) return `Use a colour code like ${example}.`;
  const ratio = contrast(value.trim(), text);
  if (ratio < 4.5) return `Too ${tooWhat}: the text on it would be ${ratio.toFixed(1)}:1, and it needs at least 4.5:1. ${tooWhat === "light" ? "Pick a deeper shade." : "Pick a lighter shade."}`;
  return true;
}

/** Payload field validation: empty (use the default) or a colour white text stays readable on. */
export const validateBrandColor = (value: unknown) => check(value, LIGHT_TEXT, "light", BRAND_COLOR_DEFAULT);
/** Payload field validation: empty (use the default) or a colour dark text stays readable on. */
export const validateButtonColor = (value: unknown) => check(value, DARK_TEXT, "dark", BUTTON_COLOR_DEFAULT);

const pick = (value: string | null | undefined, valid: (v: unknown) => true | string, fallback: string) => {
  const v = value?.trim() ?? "";
  return v && valid(v) === true ? v.toLowerCase() : fallback;
};

/** The colours to use on the site: the saved ones when valid, otherwise the defaults. */
export const brandColor = (value: string | null | undefined) => pick(value, validateBrandColor, BRAND_COLOR_DEFAULT);
export const buttonColor = (value: string | null | undefined) => pick(value, validateButtonColor, BUTTON_COLOR_DEFAULT);

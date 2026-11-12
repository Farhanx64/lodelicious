/**
 * Colour conversions for the admin colour picker (D55). Colours are stored as opaque `#rrggbb`; the
 * picker can show and accept them as Hex, RGB or HSL. Framework-free so the tests can run it.
 */
export type ColorFormat = "hex" | "rgb" | "hsl";
export const COLOR_FORMATS: readonly { value: ColorFormat; label: string }[] = [
  { value: "hex", label: "Hex" },
  { value: "rgb", label: "RGB" },
  { value: "hsl", label: "HSL" },
];

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function hexToRgb(hex: string): Rgb {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const hn = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;
  const [r, g, b] =
    hn < 60 ? [c, x, 0] : hn < 120 ? [x, c, 0] : hn < 180 ? [0, c, x] : hn < 240 ? [0, x, c] : hn < 300 ? [x, 0, c] : [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** `#9c4459` as the chosen format: `#9c4459`, `rgb(156, 68, 89)` or `hsl(346, 39%, 44%)`. */
export function formatColor(hex: string, format: ColorFormat): string {
  if (format === "hex") return hex.toLowerCase();
  const rgb = hexToRgb(hex);
  if (format === "rgb") return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const { h, s, l } = rgbToHsl(rgb);
  return `hsl(${Math.round(h) % 360}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

const NUM = String.raw`(-?\d+(?:\.\d+)?)`;
const SEP = String.raw`\s*[,\s]\s*`;
const RGB_RE = new RegExp(String.raw`^(?:rgb\(\s*)?${NUM}${SEP}${NUM}${SEP}${NUM}\s*\)?$`, "i");
const HSL_RE = new RegExp(String.raw`^(?:hsl\(\s*)?${NUM}(?:deg)?${SEP}${NUM}%?${SEP}${NUM}%?\s*\)?$`, "i");

/**
 * Reads a typed colour and returns it as lowercase `#rrggbb`, or null when it isn't one. Accepts
 * `#9c4459`, `9c4459`, `#c45`, `rgb(156, 68, 89)` / `156 68 89`, and `hsl(346, 39%, 44%)` /
 * `346 39% 44%`. Bare numbers are read in `format`. No alpha: the colours must stay opaque.
 */
export function parseColor(input: string, format: ColorFormat = "hex"): string | null {
  const v = input.trim().toLowerCase();
  if (!v) return null;
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex && (format === "hex" || v.startsWith("#") || /[a-f]/.test(v))) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return `#${h}`;
  }
  const asHsl = v.startsWith("hsl") || (format === "hsl" && !v.startsWith("rgb"));
  if (asHsl) {
    const m = HSL_RE.exec(v);
    if (!m) return null;
    const [h, s, l] = m.slice(1, 4).map(Number);
    if (s > 100 || l > 100 || s < 0 || l < 0) return null;
    return rgbToHex(hslToRgb({ h, s, l }));
  }
  const m = RGB_RE.exec(v);
  if (!m) return null;
  const [r, g, b] = m.slice(1, 4).map(Number);
  if ([r, g, b].some((c) => c < 0 || c > 255)) return null;
  return rgbToHex({ r, g, b });
}

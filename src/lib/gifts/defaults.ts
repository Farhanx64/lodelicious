/**
 * Default gift rules from PRD v2.0 and the owner's basket chart, and validation for the
 * admin-edited settings document.
 */
import {
  GIFT_TYPES,
  SIZE_CODES,
  SPECIAL_CODES,
  type CountOverride,
  type GiftSettings,
  type PresentationStatus,
  type SizeRule,
  type SpecialPresentation,
} from "./types";

export const DEFAULT_SIZES: SizeRule[] = [
  { code: "small", label: "Small", minItems: 6, maxItems: 8, packagingCents: 1995, premiumCap: 1, basketSizeIn: "12", capacityUnits: null },
  { code: "medium", label: "Medium", minItems: 10, maxItems: 12, packagingCents: 2495, premiumCap: 2, basketSizeIn: "14", capacityUnits: null },
  { code: "large", label: "Large", minItems: 12, maxItems: 14, packagingCents: 2995, premiumCap: 3, basketSizeIn: "18", capacityUnits: null },
  { code: "extra_large", label: "Extra large", minItems: 18, maxItems: 20, packagingCents: 3795, premiumCap: 4, basketSizeIn: "18–20", capacityUnits: null },
];

/** The chart's large sympathy basket is 13–16 items, an intentional exception (PRD AC 02). */
export const DEFAULT_COUNT_OVERRIDES: CountOverride[] = [
  { giftType: "sympathy", size: "large", minItems: 13, maxItems: 16, basketSizeIn: "16" },
];

export const DEFAULT_SPECIAL_PRESENTATIONS: SpecialPresentation[] = [
  {
    code: "cowboy",
    name: "Cowboy Basket",
    // Base price, fit rules and stock are missing: inquiry only until set (PRD).
    status: "inquiry",
    basePriceCents: null,
    pricing: "base_plus_contents",
    minSelections: 3,
    maxSelections: 5,
    premiumCap: null,
    capacityUnits: null,
    includedComponents: [],
    allowedCategories: [],
    variants: [],
    container: 'Cowboy basket, 10" x 8" including handle',
  },
  {
    code: "baby_white",
    name: "Baby White Basket",
    status: "inquiry",
    basePriceCents: null,
    pricing: "base_plus_contents",
    minSelections: 4,
    maxSelections: 6,
    premiumCap: null,
    capacityUnits: null,
    includedComponents: ["Baby blanket", "Teddy bear"],
    allowedCategories: ["candy", "chocolate"],
    variants: [],
    container: 'White wicker baby gift bassinet, white gloss willow. 10"H X 6 3/4"W X 12"D. The rattle in the photo is for display only and is not included.',
  },
  {
    code: "ceramic_bowl",
    name: 'Baby ceramic bowl (pink or blue)',
    // Filled ceramics: item counts for this opening are unconfirmed, so it stays disabled.
    // Price is the project lead's 2026-09-26 assumption for the empty container (D19).
    status: "disabled",
    basePriceCents: 1495,
    pricing: "base_plus_contents",
    minSelections: 1,
    maxSelections: 3,
    premiumCap: null,
    capacityUnits: null,
    includedComponents: [],
    allowedCategories: ["candy", "chocolate"],
    variants: ["pink", "blue"],
    container: 'Ceramic baby bowl with bow. 3.5"H X 3" opening',
  },
  {
    code: "ceramic_shoes",
    name: 'Baby ceramic shoes (pink or blue)',
    // Filled ceramics: item counts for this opening are unconfirmed, so it stays disabled.
    // Price is the project lead's 2026-09-26 assumption for the empty container (D19).
    status: "disabled",
    basePriceCents: 1995,
    pricing: "base_plus_contents",
    minSelections: 1,
    maxSelections: 3,
    premiumCap: null,
    capacityUnits: null,
    includedComponents: [],
    allowedCategories: ["candy", "chocolate"],
    variants: ["pink", "blue"],
    container: 'Ceramic pair of baby shoes with bow. 3"H X 5.75"W X 5"D, opening 2.5"H X 5"W X 3.25"D',
  },
  {
    code: "ceramic_block",
    name: 'Baby ceramic "BABY" block (pink or blue)',
    // Filled ceramics: item counts for this opening are unconfirmed, so it stays disabled.
    // Price is the project lead's 2026-09-26 assumption for the empty container (D19).
    status: "disabled",
    basePriceCents: 1495,
    pricing: "base_plus_contents",
    minSelections: 1,
    maxSelections: 3,
    premiumCap: null,
    capacityUnits: null,
    includedComponents: [],
    allowedCategories: ["candy", "chocolate"],
    variants: ["pink", "blue"],
    container: 'Ceramic gingham block that spells BABY. 4"H X 3.5"W X 3" opening',
  },
];

export const DEFAULT_GIFT_SETTINGS: GiftSettings = {
  sizes: DEFAULT_SIZES,
  countOverrides: DEFAULT_COUNT_OVERRIDES,
  specialPresentations: DEFAULT_SPECIAL_PRESENTATIONS,
};

export class GiftSettingsError extends Error {}

function count(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new GiftSettingsError(`${where} must be a whole number of 0 or more`);
  }
  return value;
}

function nullableCount(value: unknown, where: string): number | null {
  return value === null || value === undefined ? null : count(value, where);
}

function range(min: number, max: number, where: string): void {
  if (min > max) throw new GiftSettingsError(`${where}: minimum (${min}) is above maximum (${max})`);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], where: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new GiftSettingsError(`${where} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);
const strings = (value: unknown): string[] =>
  rows(value)
    .map((r) => (typeof r === "string" ? r : String(r.value ?? "")))
    .filter(Boolean);

/**
 * Convert and validate the stored settings document. Throws GiftSettingsError with an
 * admin-readable message; the builder refuses to run on invalid rules.
 */
export function parseSettings(doc: Row): GiftSettings {
  const sizes = rows(doc.sizes).map((r, i): SizeRule => {
    const where = `Basket size ${i + 1}`;
    const rule: SizeRule = {
      code: oneOf(r.code, SIZE_CODES, `${where} code`),
      label: String(r.label ?? ""),
      minItems: count(r.minItems, `${where} minimum items`),
      maxItems: count(r.maxItems, `${where} maximum items`),
      packagingCents: count(r.packagingCents, `${where} packaging`),
      premiumCap: count(r.premiumCap, `${where} premium maximum`),
      basketSizeIn: String(r.basketSizeIn ?? ""),
      capacityUnits: nullableCount(r.capacityUnits, `${where} capacity`),
    };
    range(rule.minItems, rule.maxItems, where);
    return rule;
  });
  const codes = sizes.map((s) => s.code);
  if (new Set(codes).size !== codes.length) throw new GiftSettingsError("Each basket size may appear only once");

  const countOverrides = rows(doc.countOverrides).map((r, i): CountOverride => {
    const where = `Count override ${i + 1}`;
    const o: CountOverride = {
      giftType: oneOf(r.giftType, GIFT_TYPES, `${where} gift type`),
      size: oneOf(r.size, SIZE_CODES, `${where} size`),
      minItems: count(r.minItems, `${where} minimum items`),
      maxItems: count(r.maxItems, `${where} maximum items`),
      basketSizeIn: typeof r.basketSizeIn === "string" && r.basketSizeIn.trim() !== "" ? r.basketSizeIn : null,
    };
    range(o.minItems, o.maxItems, where);
    return o;
  });
  const keys = countOverrides.map((o) => `${o.giftType}/${o.size}`);
  if (new Set(keys).size !== keys.length) throw new GiftSettingsError("Each gift type and size may be overridden only once");

  const specialPresentations = rows(doc.specialPresentations).map((r, i): SpecialPresentation => {
    const where = `Special presentation ${i + 1}`;
    const p: SpecialPresentation = {
      code: oneOf(r.code, SPECIAL_CODES, `${where} code`),
      name: String(r.name ?? ""),
      status: oneOf<PresentationStatus>(r.status, ["available", "inquiry", "disabled"], `${where} status`),
      basePriceCents: nullableCount(r.basePriceCents, `${where} price`),
      pricing: oneOf(r.pricing ?? "base_plus_contents", ["base_plus_contents", "fixed"] as const, `${where} pricing`),
      minSelections: count(r.minSelections, `${where} minimum selections`),
      maxSelections: count(r.maxSelections, `${where} maximum selections`),
      premiumCap: nullableCount(r.premiumCap, `${where} premium maximum`),
      capacityUnits: nullableCount(r.capacityUnits, `${where} capacity`),
      includedComponents: strings(r.includedComponents),
      allowedCategories: strings(r.allowedCategories),
      variants: strings(r.variants),
      container: typeof r.container === "string" && r.container.trim() !== "" ? r.container : null,
    };
    range(p.minSelections, p.maxSelections, where);
    if (p.status === "available" && (p.basePriceCents === null || p.premiumCap === null)) {
      throw new GiftSettingsError(`${where} (${p.name}): set a price and premium maximum before making it available`);
    }
    return p;
  });

  const specialCodes = specialPresentations.map((p) => p.code);
  if (new Set(specialCodes).size !== specialCodes.length) throw new GiftSettingsError("Each special presentation may appear only once");

  return { sizes, countOverrides, specialPresentations };
}

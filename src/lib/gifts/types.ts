/**
 * Gift-builder domain types (PRD GFT 01–06). No Payload or framework imports: the same engine
 * runs for the live preview, add-to-cart and checkout, and the server result is authoritative.
 */
import type { Cents } from "../money";

export const GIFT_TYPES = ["sweet", "savory", "sweet_savory", "sympathy"] as const;
export type GiftType = (typeof GIFT_TYPES)[number];

export const SIZE_CODES = ["small", "medium", "large", "extra_large"] as const;
export type SizeCode = (typeof SIZE_CODES)[number];

export const SPECIAL_CODES = ["cowboy", "baby_white", "ceramic_bowl", "ceramic_shoes", "ceramic_block"] as const;
export type SpecialCode = (typeof SPECIAL_CODES)[number];

/** Standard custom-builder basket size. Packaging is the builder fee, not a curated price. */
export type SizeRule = {
  code: SizeCode;
  label: string;
  minItems: number;
  maxItems: number;
  packagingCents: Cents;
  premiumCap: number;
  basketSizeIn: string;
  /** Total fit units the container holds; null = enforce counts only (products not measured). */
  capacityUnits: number | null;
};

/** Gift-type-specific count range, e.g. large sympathy 13–16 from the owner's chart. */
export type CountOverride = {
  giftType: GiftType;
  size: SizeCode;
  minItems: number;
  maxItems: number;
};

export type PresentationStatus = "available" | "inquiry" | "disabled";

/** Cowboy, Baby White and filled ceramics: separate rules, never standard counts or fees. */
export type SpecialPresentation = {
  code: SpecialCode;
  name: string;
  status: PresentationStatus;
  /** Includes the container and any included components. Null = not priced, cannot be bought. */
  basePriceCents: Cents | null;
  /**
   * "base_plus_contents": base price + price of each selected product.
   * "fixed": base price covers the selections too. Unconfirmed for both presentations (PRD).
   */
  pricing: "base_plus_contents" | "fixed";
  minSelections: number;
  maxSelections: number;
  /** Null = cap not approved yet; purchase stays blocked until it is set. */
  premiumCap: number | null;
  capacityUnits: number | null;
  /** Components that come with the presentation and do not count as selections. */
  includedComponents: string[];
  /** Product categories customers may choose from; empty = any basket-eligible product. */
  allowedCategories: string[];
  /** Container options the customer must pick from (e.g. pink, blue); empty = no choice. */
  variants: string[];
  /** Container description with supplier dimensions, verbatim. */
  container: string | null;
};

export type GiftSettings = {
  sizes: SizeRule[];
  countOverrides: CountOverride[];
  specialPresentations: SpecialPresentation[];
};

export type StockState =
  | { state: "known"; quantity: number }
  | { state: "unknown" }
  | { state: "stale" };

export type Channel = "online" | "in_store_only" | "hidden" | "inquiry_only";

/**
 * What the engine needs to know about a product. Rules never read the product name, so a
 * renamed product behaves identically.
 */
export type BuilderProduct = {
  id: string;
  name: string;
  priceCents: Cents | null;
  priceApproved: boolean;
  stock: StockState;
  /** Verified premium brand (Phillips, Cape Cod Fudge, OMNIYA, Swiss Chocolate). Never inferred. */
  premium: boolean;
  giftTypes: GiftType[];
  basketEligible: boolean;
  category: string;
  channel: Channel;
  /** Only selectable inside this special presentation (the Baby White blanket). */
  exclusiveTo: SpecialCode | null;
  /** 1 for most products; higher only for products sold in multiples or assortments. */
  maxPerGift: number;
  fitUnits: number;
};

export type Selection = { productId: string; quantity: number };

export type GiftRequest =
  | { kind: "custom"; size: SizeCode; giftType: GiftType; budgetCents: Cents | null; selections: Selection[] }
  | { kind: "special"; presentation: SpecialCode; variant?: string; selections: Selection[] };

export type ViolationCode =
  | "UNKNOWN_PRODUCT"
  | "INVALID_QUANTITY"
  | "NOT_ELIGIBLE"
  | "REPEAT_LIMIT"
  | "INSUFFICIENT_STOCK"
  | "COUNT_ABOVE_MAX"
  | "COUNT_BELOW_MIN"
  | "PREMIUM_CAP"
  | "OVER_BUDGET"
  | "BUDGET_BELOW_PACKAGING"
  | "FIT_EXCEEDED"
  | "PRESENTATION_UNAVAILABLE"
  | "VARIANT_REQUIRED"
  | "UNKNOWN_VARIANT"
  | "SPECIAL_CATEGORY";

export type Violation = { code: ViolationCode; message: string; productId?: string };

export type GiftTotals = {
  itemCount: number;
  premiumCount: number;
  contentsCents: Cents;
  packagingCents: Cents;
  /** Contents + packaging (custom) or the presentation price (special). Tax and fulfillment excluded. */
  totalCents: Cents;
  remainingBudgetCents: Cents | null;
  fitUsed: number;
};

export type GiftValidation = {
  /** No rule is broken. An incomplete gift can still be valid (the preview shows progress). */
  valid: boolean;
  /** Valid and meets the minimum count: may be added to the cart. */
  complete: boolean;
  totals: GiftTotals;
  countRange: { min: number; max: number };
  premiumCap: number | null;
  violations: Violation[];
};

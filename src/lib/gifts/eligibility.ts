/**
 * Whether a product may go into a particular gift, with a customer-readable reason when not
 * (PRD GFT 03: "Explain unavailable choices").
 */
import type { Cents } from "../money";
import type { BuilderProduct, GiftSettings, GiftType, SpecialCode } from "./types";

export type IneligibleReason =
  | "hidden"
  | "in_store_only"
  | "inquiry_only"
  | "not_basket_item"
  | "exclusive_elsewhere"
  | "price_not_confirmed"
  | "stock_uncertain"
  | "out_of_stock"
  | "wrong_gift_type"
  | "wrong_category"
  | "already_selected"
  | "premium_limit"
  | "over_budget";

export type Eligibility = { eligible: true } | { eligible: false; reason: IneligibleReason; message: string };

export type EligibilityContext = {
  settings: GiftSettings;
  target: { kind: "custom"; giftType: GiftType } | { kind: "special"; presentation: SpecialCode };
};

/** Live picker context: what is already in the gift. */
export type PickerContext = EligibilityContext & {
  selectedQuantity: number;
  remainingBudgetCents: Cents | null;
  premiumRemaining: number | null;
};

const GIFT_TYPE_LABEL: Record<GiftType, string> = {
  sweet: "sweet",
  savory: "savory",
  sweet_savory: "sweet and savory",
  sympathy: "sympathy",
};

const no = (reason: IneligibleReason, message: string): Eligibility => ({ eligible: false, reason, message });

/** Rules that hold regardless of what is already selected. */
export function checkProduct(product: BuilderProduct, ctx: EligibilityContext): Eligibility {
  switch (product.channel) {
    case "hidden":
      return no("hidden", "Not available online.");
    case "in_store_only":
      return no("in_store_only", "Available in our shop only.");
    case "inquiry_only":
      return no("inquiry_only", "Available by inquiry — please contact us.");
  }
  if (product.exclusiveTo) {
    if (ctx.target.kind !== "special" || ctx.target.presentation !== product.exclusiveTo) {
      const name = ctx.settings.specialPresentations.find((p) => p.code === product.exclusiveTo)?.name ?? "another gift";
      return no("exclusive_elsewhere", `Only included with the ${name}.`);
    }
    // Included components (the Baby White blanket) are part of the presentation, not a selection.
    return no("not_basket_item", "Already included with this gift.");
  }
  if (!product.basketEligible) return no("not_basket_item", "Not available as a basket item.");
  if (!product.priceApproved || product.priceCents === null) return no("price_not_confirmed", "Currently unavailable.");
  if (product.stock.state !== "known") return no("stock_uncertain", "Currently unavailable.");
  if (product.stock.quantity <= 0) return no("out_of_stock", "Currently unavailable.");

  if (ctx.target.kind === "custom") {
    if (!product.giftTypes.includes(ctx.target.giftType)) {
      return no("wrong_gift_type", `Not part of our ${GIFT_TYPE_LABEL[ctx.target.giftType]} selection.`);
    }
  } else {
    const code = ctx.target.presentation;
    const presentation = ctx.settings.specialPresentations.find((p) => p.code === code);
    if (presentation && presentation.allowedCategories.length > 0 && !presentation.allowedCategories.includes(product.category)) {
      return no("wrong_category", `Not one of the choices for the ${presentation.name}.`);
    }
  }
  return { eligible: true };
}

/** Static rules plus what the customer has already chosen, for filtering the picker. */
export function checkForPicker(product: BuilderProduct, ctx: PickerContext): Eligibility {
  const base = checkProduct(product, ctx);
  if (!base.eligible) return base;
  if (ctx.selectedQuantity >= product.maxPerGift) return no("already_selected", "Already in your gift.");
  if (product.stock.state === "known" && ctx.selectedQuantity >= product.stock.quantity) {
    return no("out_of_stock", "No more available right now.");
  }
  if (product.premium && ctx.premiumRemaining !== null && ctx.premiumRemaining <= 0) {
    return no("premium_limit", "You've reached the premium-item limit for this size.");
  }
  if (ctx.remainingBudgetCents !== null && (product.priceCents ?? 0) > ctx.remainingBudgetCents) {
    return no("over_budget", "More than your remaining budget.");
  }
  return { eligible: true };
}

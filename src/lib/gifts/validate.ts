/**
 * Server-authoritative gift validation (PRD GFT 02–05, "Server validation and handoff").
 * The same function drives the live preview, add-to-cart and checkout.
 */
import { formatCents, multiplyCents, sumCents } from "../money";
import { checkProduct } from "./eligibility";
import { packagingFor, resolveCountRange, sizeRule, specialPresentation } from "./rules";
import type { BuilderProduct, GiftRequest, GiftSettings, GiftValidation, Selection, Violation } from "./types";

export type Catalog = ReadonlyMap<string, BuilderProduct>;

export function catalogOf(products: readonly BuilderProduct[]): Catalog {
  return new Map(products.map((p) => [p.id, p]));
}

/** Merge repeated lines for the same product so limits apply to the total quantity. */
function mergeSelections(selections: readonly Selection[]): Selection[] {
  const merged = new Map<string, number>();
  for (const s of selections) merged.set(s.productId, (merged.get(s.productId) ?? 0) + s.quantity);
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

export function validateGift(request: GiftRequest, settings: GiftSettings, catalog: Catalog): GiftValidation {
  const violations: Violation[] = [];
  const add = (v: Violation) => violations.push(v);

  let countRange: { min: number; max: number };
  let premiumCap: number | null;
  let capacity: number | null;
  let presentationUnavailable = false;

  if (request.kind === "custom") {
    const rule = sizeRule(settings, request.size);
    countRange = resolveCountRange(settings, request.size, request.giftType);
    premiumCap = rule.premiumCap;
    capacity = rule.capacityUnits;
  } else {
    const p = specialPresentation(settings, request.presentation);
    countRange = { min: p.minSelections, max: p.maxSelections };
    premiumCap = p.premiumCap;
    capacity = p.capacityUnits;
    if (p.variants.length > 0) {
      if (!request.variant) {
        add({ code: "VARIANT_REQUIRED", message: `Choose a colour for the ${p.name}: ${p.variants.join(" or ")}.` });
      } else if (!p.variants.includes(request.variant)) {
        add({ code: "UNKNOWN_VARIANT", message: `"${request.variant}" isn't available for the ${p.name}.` });
      }
    }
    if (p.status !== "available" || p.basePriceCents === null || p.premiumCap === null) {
      presentationUnavailable = true;
      add({
        code: "PRESENTATION_UNAVAILABLE",
        message: `The ${p.name} is available by inquiry only. Please contact us to order one.`,
      });
    }
  }

  const target =
    request.kind === "custom"
      ? ({ kind: "custom", giftType: request.giftType } as const)
      : ({ kind: "special", presentation: request.presentation } as const);

  let itemCount = 0;
  let premiumCount = 0;
  let fitUsed = 0;
  const lineTotals: number[] = [];

  for (const { productId, quantity } of mergeSelections(request.selections)) {
    const product = catalog.get(productId);
    if (!product) {
      add({ code: "UNKNOWN_PRODUCT", message: "An item in this gift is no longer available.", productId });
      continue;
    }
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      add({ code: "INVALID_QUANTITY", message: `Invalid quantity for ${product.name}.`, productId });
      continue;
    }

    const eligibility = checkProduct(product, { settings, target });
    if (!eligibility.eligible) {
      add({
        code: eligibility.reason === "wrong_category" ? "SPECIAL_CATEGORY" : "NOT_ELIGIBLE",
        message: `${product.name}: ${eligibility.message}`,
        productId,
      });
    } else {
      if (quantity > product.maxPerGift) {
        add({
          code: "REPEAT_LIMIT",
          message:
            product.maxPerGift === 1
              ? `${product.name} can be included once per gift.`
              : `${product.name} can be included up to ${product.maxPerGift} times per gift.`,
          productId,
        });
      }
      if (product.stock.state === "known" && quantity > product.stock.quantity) {
        add({ code: "INSUFFICIENT_STOCK", message: `Only ${product.stock.quantity} of ${product.name} available.`, productId });
      }
    }

    // One packaged sellable unit counts as one item (a two-piece pretzel pack, a teddy bear).
    itemCount += quantity;
    if (product.premium) premiumCount += quantity;
    fitUsed += product.fitUnits * quantity;
    if (product.priceCents !== null) lineTotals.push(multiplyCents(product.priceCents, quantity));
  }

  if (itemCount > countRange.max) {
    add({ code: "COUNT_ABOVE_MAX", message: `This gift holds at most ${countRange.max} items; you have ${itemCount}.` });
  }
  if (itemCount < countRange.min) {
    add({
      code: "COUNT_BELOW_MIN",
      message: `Choose ${countRange.min - itemCount} more item${countRange.min - itemCount === 1 ? "" : "s"} (at least ${countRange.min}).`,
    });
  }
  // Premium items also count toward the overall total (they are included in itemCount above).
  if (premiumCap !== null && premiumCount > premiumCap) {
    add({ code: "PREMIUM_CAP", message: `This size allows up to ${premiumCap} premium item${premiumCap === 1 ? "" : "s"}; you have ${premiumCount}.` });
  }
  if (capacity !== null && fitUsed > capacity) {
    add({ code: "FIT_EXCEEDED", message: "These items won't all fit in this basket. Try a larger size or smaller items." });
  }

  const contentsCents = sumCents(lineTotals);
  let packagingCents = 0;
  let totalCents: number;
  let remainingBudgetCents: number | null = null;

  if (request.kind === "custom") {
    packagingCents = packagingFor(settings, "custom", request.size);
    totalCents = contentsCents + packagingCents;
    if (request.budgetCents !== null) {
      remainingBudgetCents = request.budgetCents - totalCents;
      if (request.budgetCents < packagingCents) {
        add({
          code: "BUDGET_BELOW_PACKAGING",
          message: `A budget of ${formatCents(request.budgetCents)} doesn't cover the ${formatCents(packagingCents)} basket and packaging.`,
        });
      } else if (totalCents > request.budgetCents) {
        add({ code: "OVER_BUDGET", message: `This gift is ${formatCents(-remainingBudgetCents)} over your budget.` });
      }
    }
  } else {
    const p = specialPresentation(settings, request.presentation);
    const base = p.basePriceCents ?? 0;
    packagingCents = packagingFor(settings, "special");
    totalCents = packagingCents + (p.pricing === "fixed" ? base : base + contentsCents);
  }

  const blocking = violations.filter((v) => v.code !== "COUNT_BELOW_MIN");
  const valid = blocking.length === 0 && !presentationUnavailable;
  return {
    valid,
    complete: valid && itemCount >= countRange.min && itemCount > 0,
    totals: { itemCount, premiumCount, contentsCents, packagingCents, totalCents, remainingBudgetCents, fitUsed },
    countRange,
    premiumCap,
    violations,
  };
}

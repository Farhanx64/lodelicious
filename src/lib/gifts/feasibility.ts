/**
 * Can a basket of this size and type be completed within the budget with what is in stock?
 * Lets the builder suggest a smaller size or a higher budget up front instead of promising
 * that every budget fills every basket (PRD GFT 03).
 */
import type { Cents } from "../money";
import { checkProduct } from "./eligibility";
import { packagingFor, resolveCountRange, sizeRule } from "./rules";
import type { BuilderProduct, GiftSettings, GiftType, SizeCode } from "./types";

export type Feasibility = {
  feasible: boolean;
  /** Packaging + cheapest valid minimum fill, or null when stock can't reach the minimum count. */
  minimumBudgetCents: Cents | null;
  /** Smaller sizes that could be completed within the budget, smallest last. */
  smallerSizesThatFit: SizeCode[];
};

/**
 * Cheapest way to pick `min` units: all eligible units sorted by price, taking premium units only
 * while under the cap. Greedy is optimal here because the only coupling constraint is a cap on
 * one subset of units.
 */
function cheapestFill(
  settings: GiftSettings,
  size: SizeCode,
  giftType: GiftType,
  products: readonly BuilderProduct[],
): Cents | null {
  const { min } = resolveCountRange(settings, size, giftType);
  const cap = sizeRule(settings, size).premiumCap;
  const units: { price: number; premium: boolean }[] = [];
  for (const p of products) {
    if (!checkProduct(p, { settings, target: { kind: "custom", giftType } }).eligible) continue;
    const available = p.stock.state === "known" ? Math.min(p.maxPerGift, p.stock.quantity) : 0;
    for (let i = 0; i < available; i++) units.push({ price: p.priceCents ?? 0, premium: p.premium });
  }
  units.sort((a, b) => a.price - b.price);

  let total = 0;
  let taken = 0;
  let premiumTaken = 0;
  for (const u of units) {
    if (taken === min) break;
    if (u.premium) {
      if (premiumTaken >= cap) continue;
      premiumTaken++;
    }
    total += u.price;
    taken++;
  }
  return taken === min ? total + packagingFor(settings, "custom", size) : null;
}

export function assessFeasibility(
  settings: GiftSettings,
  size: SizeCode,
  giftType: GiftType,
  budgetCents: Cents | null,
  products: readonly BuilderProduct[],
): Feasibility {
  const fits = (s: SizeCode) => {
    const minimum = cheapestFill(settings, s, giftType, products);
    return { minimum, ok: minimum !== null && (budgetCents === null || minimum <= budgetCents) };
  };

  const current = fits(size);
  const currentMin = resolveCountRange(settings, size, giftType).min;
  const smallerSizesThatFit = current.ok
    ? []
    : settings.sizes
        .filter((s) => resolveCountRange(settings, s.code, giftType).min < currentMin)
        .sort((a, b) => b.minItems - a.minItems)
        .filter((s) => fits(s.code).ok)
        .map((s) => s.code);

  return { feasible: current.ok, minimumBudgetCents: current.minimum, smallerSizesThatFit };
}

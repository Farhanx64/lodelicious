/**
 * The checkout and reserve pages' figures for each way the order can be taxed (D65), worked out
 * exactly as `placeOrder` and `reserveBasket` charge them. Pickup has one version. Shipped has one
 * per state in "Tax by ship-to state" plus "none" for every other state; the page shows the one for
 * the state chosen in the address. Framework free, so tests check the page and the charge agree.
 */
import type { ApplePayAmount } from "../payments/apple-pay";
import { formatCents } from "../money";
import { formatPoints, totalsWithDiscount, type RewardOption } from "../rewards/program";
import { retaxCart, type PricedCart } from "./cart";
import type { PricedBasket } from "./service";
import { classForBasis, describeBasisNote, shippedBases, type ShipTaxRule, type TaxBasis } from "./ship-tax";
import { computeTax, describeTax } from "./tax";

export type Method = "pickup" | "ship";

function basesFor(method: Method, rules: readonly ShipTaxRule[]): { key: string; basis: TaxBasis }[] {
  return method === "ship" ? shippedBases(rules) : [{ key: "pickup", basis: { kind: "pickup" } }];
}

export type BagTaxView = {
  key: string;
  basis: TaxBasis;
  bag: PricedCart;
  /** With shipping. */
  totalCents: number;
  /** Each affordable reward, labelled with the total it leaves, and what checkout charges with it (plus shipping). */
  rewards: { id: string; label: string; chargeCents: number }[];
  /** What the Apple Pay or Google Pay sheet shows (D59, D63), following the reward radio. */
  wallet: ApplePayAmount;
  taxNote: string;
};

export function bagTaxViews(bag: PricedCart, opts: { method: Method; shippingCents: number; rules: readonly ShipTaxRule[]; rewards: readonly RewardOption[] }): BagTaxView[] {
  return basesFor(opts.method, opts.rules).map(({ key, basis }) => {
    const taxed = retaxCart(bag, basis);
    const lines = taxed.payable.map((l) => ({ amountCents: l.lineTotalCents, taxClass: l.taxClass }));
    const totalCents = taxed.totalCents + opts.shippingCents;
    const rewards = opts.rewards.map((o) => {
      // A reward comes off before tax, then tax is worked out on what is left, as checkout does (D47).
      const discounted = totalsWithDiscount(lines, o.discountCents).totalCents;
      return { id: o.id, label: `${formatCents(o.discountCents)} off for ${formatPoints(o.pointsRequired)} (total ${formatCents(discounted)})`, chargeCents: discounted + opts.shippingCents };
    });
    const wallet: ApplePayAmount = {
      cents: totalCents,
      ...(rewards.length ? { byChoice: { field: "reward", cents: { none: totalCents, ...Object.fromEntries(rewards.map((o) => [o.id, o.chargeCents])) } } } : {}),
    };
    const taxNote = describeBasisNote(basis) ?? describeTax(taxed.payable.map((l) => l.taxClass), taxed.taxApproved);
    return { key, basis, bag: taxed, totalCents, rewards, wallet, taxNote };
  });
}

/** A priced basket taxed for where it goes (D65); pickup is the basket as priced. */
export function retaxBasket<T extends PricedBasket>(basket: T, basis: TaxBasis): T {
  if (basis.kind === "pickup") return basket;
  const taxClasses = basket.taxClasses.map((c) => classForBasis(c, basis));
  const tax = computeTax(taxClasses.map((taxClass, i) => ({ amountCents: basket.taxAmounts[i] ?? 0, taxClass })));
  return { ...basket, taxClasses, taxCents: tax.taxCents, totalCents: basket.subtotalCents + tax.taxCents, taxApproved: tax.approved };
}

export type BasketTaxView = {
  key: string;
  basis: TaxBasis;
  basket: PricedBasket;
  /** With shipping. */
  grandTotal: number;
  /** What is charged now: a shipped basket in full; pickup follows the deposit / pay-in-full choice. */
  wallet: ApplePayAmount;
  taxNote: string;
};

export function basketTaxViews(
  basket: PricedBasket,
  opts: { method: Method; shippingCents: number; rules: readonly ShipTaxRule[]; deposit: { chargeNowCents: number }; allowPayInFull: boolean },
): BasketTaxView[] {
  return basesFor(opts.method, opts.rules).map(({ key, basis }) => {
    const taxed = retaxBasket(basket, basis);
    const grandTotal = taxed.totalCents + opts.shippingCents;
    const wallet: ApplePayAmount =
      opts.method === "ship"
        ? { cents: grandTotal }
        : { cents: opts.deposit.chargeNowCents, byChoice: { field: "payment", cents: { deposit: opts.deposit.chargeNowCents, ...(opts.allowPayInFull ? { full: taxed.totalCents } : {}) } } };
    return { key, basis, basket: taxed, grandTotal, wallet, taxNote: describeBasisNote(basis) ?? describeTax(taxed.taxClasses, taxed.taxApproved) };
  });
}

/** `{ key: pick(view) }` for every view, for the client components that follow the chosen state. */
export function byView<V extends { key: string }, T>(views: readonly V[], pick: (v: V) => T): Record<string, T> {
  return Object.fromEntries(views.map((v) => [v.key, pick(v)]));
}

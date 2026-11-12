/**
 * The floating receipt bar (D58): where it shows, and what it lists. Framework-free so the rules
 * can be tested without a browser. Prices and tax come from the priced bag (`priceCart`), so the
 * bar never works out a figure of its own.
 */
import { PRICE_TO_BE_CONFIRMED } from "../catalog/product";
import type { PricedCart, PricedLine } from "./cart";
import { formatRate } from "./tax";

/**
 * Pages that already show the order, or aren't the shop: the bag itself, checkout and reserve
 * (their own summary and sticky Pay button, D56), and the staff admin.
 */
export const RECEIPT_HIDDEN_PREFIXES = ["/admin", "/cart", "/checkout", "/reserve"] as const;

export function receiptAllowedOn(pathname: string | null | undefined): boolean {
  const path = (pathname ?? "/").split(/[?#]/)[0] || "/";
  return !RECEIPT_HIDDEN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Shown on storefront pages once the bag holds at least one item. */
export function showReceipt(pathname: string | null | undefined, itemCount: number): boolean {
  return itemCount > 0 && receiptAllowedOn(pathname);
}

export type ReceiptImage = { src: string; alt: string };

export type ReceiptLine = {
  key: string;
  title: string;
  detail: string | null;
  href: string;
  quantity: number;
  /** Null when the price isn't approved yet (A06) or the line can't be bought now. */
  totalCents: number | null;
  note: string | null;
  /** Can't be bought now: the note is shown as an error. */
  unavailable: boolean;
  image: ReceiptImage | null;
};

export type ReceiptData = {
  itemCount: number;
  lines: ReceiptLine[];
  subtotalCents: number;
  taxCents: number;
  /** "Estimated tax (6.25%)": the rate comes from the tax classes the lines actually use. */
  taxLabel: string;
  /** A line can't be bought: the bar sends the customer to the bag instead of checkout. */
  blocking: boolean;
};

export const EMPTY_RECEIPT: ReceiptData = { itemCount: 0, lines: [], subtotalCents: 0, taxCents: 0, taxLabel: "Estimated tax", blocking: false };

/** One rate across the taxed lines names it; several, or none taxed, leave the label plain. */
export function receiptTaxLabel(lines: readonly Pick<PricedLine, "taxClass">[]): string {
  const rates = new Set(lines.flatMap((l) => (l.taxClass && l.taxClass.rateBasisPoints > 0 ? [l.taxClass.rateBasisPoints] : [])));
  return rates.size === 1 ? `Estimated tax (${formatRate([...rates][0])})` : "Estimated tax";
}

export function receiptFromBag(bag: PricedCart, images: ReadonlyMap<string, ReceiptImage | null> = new Map()): ReceiptData {
  return {
    itemCount: bag.itemCount,
    lines: bag.lines.map((l) => {
      const unavailable = Boolean(l.problem?.blocking);
      return {
        key: l.unitId,
        title: l.title,
        detail: l.optionLabel,
        href: `/shop/${l.slug}`,
        quantity: l.quantity,
        totalCents: unavailable || !l.priceApproved ? null : l.lineTotalCents,
        note: unavailable ? "No longer available online" : l.priceApproved ? null : PRICE_TO_BE_CONFIRMED,
        unavailable,
        image: images.get(l.productId) ?? null,
      };
    }),
    subtotalCents: bag.subtotalCents,
    taxCents: bag.taxCents,
    taxLabel: receiptTaxLabel(bag.payable),
    blocking: bag.blocking,
  };
}

export const itemsLabel = (n: number) => `${n} item${n === 1 ? "" : "s"}`;

/** Fired on `window` by the add-to-bag forms after a successful add, so the bar slides in. */
export const BAG_ADDED_EVENT = "lodelicious:bag-added";

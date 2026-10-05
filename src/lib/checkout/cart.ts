/**
 * Price a cart against the live catalog (D35). The cart stores only product/option ids and
 * quantities; every price, availability and limit is re-read here, so a changed price or a sold-out
 * product can never be charged silently.
 */
import type { Product } from "@/payload-types";

import { onlineQuantity } from "../catalog/availability";
import { sellableUnits } from "../catalog/product";
import { multiplyCents, sumCents, type Cents } from "../money";
import { computeTax, resolveTaxClass, type TaxClass } from "./tax";

export const MAX_LINE_QUANTITY = 20;

export type CartLine = { unitId: string; quantity: number };

export type LineProblem =
  | { code: "UNAVAILABLE"; message: string; blocking: true }
  | { code: "REDUCED"; message: string; blocking: false };

export type PricedLine = {
  unitId: string;
  productId: string;
  slug: string;
  title: string;
  optionLabel: string | null;
  sku: string | null;
  cloverId: string | null;
  quantity: number;
  unitPriceCents: Cents;
  lineTotalCents: Cents;
  taxClass: TaxClass | null;
  taxCents: Cents;
  problem: LineProblem | null;
};

export type PricedCart = {
  lines: PricedLine[];
  /** Lines that can be bought now. */
  payable: PricedLine[];
  subtotalCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  taxApproved: boolean;
  blocking: boolean;
  itemCount: number;
};

export type PriceCartOptions = {
  /** Staging review aid: uncounted stock counts as available (never in production). */
  previewStock: boolean;
  taxClasses: TaxClass[];
  defaultTaxClassId: string | null;
};

function relId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "object" ? String((value as { id: unknown }).id) : String(value);
}

/** How many of a unit the website may sell right now, or 0. */
function sellableMax(product: Product, variantKey: string | null, previewStock: boolean): number {
  const unit = sellableUnits(product).find((u) => u.variantKey === variantKey);
  if (!unit || product.channel !== "online" || !product.priceApproved || unit.priceCents === null) return 0;
  const stockOf = variantKey ? product.variants?.find((v) => v.key === variantKey) : product;
  if (!stockOf) return 0;
  if (stockOf.stockState === "known" && typeof stockOf.stockQuantity === "number") {
    return Math.min(MAX_LINE_QUANTITY, onlineQuantity(stockOf.stockQuantity, product.onlineReserve ?? null));
  }
  return previewStock ? MAX_LINE_QUANTITY : 0;
}

export function priceCart(cart: readonly CartLine[], products: readonly Product[], opts: PriceCartOptions): PricedCart {
  const byId = new Map(products.map((p) => [String(p.id), p]));
  const lines: PricedLine[] = [];

  for (const line of cart) {
    const [productId, variantKey = null] = line.unitId.split(":") as [string, string?];
    const product = byId.get(productId);
    const unit = product ? sellableUnits(product).find((u) => u.variantKey === (variantKey ?? null)) : undefined;
    if (!product || !unit) continue; // deleted or unpublished: drop silently, nothing to show

    const max = sellableMax(product, variantKey ?? null, opts.previewStock);
    const wanted = Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.trunc(line.quantity) || 1));
    let quantity = wanted;
    let problem: LineProblem | null = null;
    if (max === 0) {
      problem = { code: "UNAVAILABLE", message: "No longer available online — please remove it to continue.", blocking: true };
    } else if (wanted > max) {
      quantity = max;
      problem = { code: "REDUCED", message: `Only ${max} available, so we changed the quantity.`, blocking: false };
    }

    const unitPriceCents = unit.priceCents ?? 0;
    const lineTotalCents = multiplyCents(unitPriceCents, quantity);
    const taxClass = resolveTaxClass(relId(product.taxClass), opts.taxClasses, opts.defaultTaxClassId);
    const variant = variantKey ? product.variants?.find((v) => v.key === variantKey) : null;
    lines.push({
      unitId: line.unitId,
      productId,
      slug: product.slug ?? "",
      title: product.title,
      optionLabel: variant?.label ?? null,
      sku: product.sku ?? null,
      cloverId: product.cloverId ?? null,
      quantity,
      unitPriceCents,
      lineTotalCents,
      taxClass,
      taxCents: 0,
      problem,
    });
  }

  const payable = lines.filter((l) => !l.problem?.blocking);
  const tax = computeTax(payable.map((l) => ({ amountCents: l.lineTotalCents, taxClass: l.taxClass })));
  payable.forEach((l, i) => (l.taxCents = tax.perLine[i]));
  const subtotalCents = sumCents(payable.map((l) => l.lineTotalCents));
  return {
    lines,
    payable,
    subtotalCents,
    taxCents: tax.taxCents,
    totalCents: subtotalCents + tax.taxCents,
    taxApproved: payable.length > 0 && tax.approved,
    blocking: lines.some((l) => l.problem?.blocking),
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
  };
}

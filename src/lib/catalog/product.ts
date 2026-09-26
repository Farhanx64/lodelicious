/**
 * Adapters from the admin-edited Product document to the storefront and the gift engine.
 * Framework-free: takes the plain document, so it is unit-testable without Payload.
 */
import type { Category, Product } from "@/payload-types";

import type { BuilderProduct, GiftType, SpecialCode } from "../gifts/types";
import { availabilityOf, type Availability } from "./availability";

type Variant = NonNullable<Product["variants"]>[number];

export type SellableUnit = {
  /** `${productId}` or `${productId}:${variantKey}` — the id carts and gifts refer to. */
  id: string;
  productId: string;
  variantKey: string | null;
  name: string;
  priceCents: number | null;
  availability: Availability;
};

function categorySlug(category: Product["category"]): string {
  return typeof category === "object" && category !== null ? ((category as Category).slug ?? "") : "";
}

function unitAvailability(product: Product, variant: Variant | null): Availability {
  return availabilityOf({
    channel: product.channel,
    priceCents: variant?.priceCents ?? product.priceCents ?? null,
    priceApproved: Boolean(product.priceApproved),
    stockState: (variant ?? product).stockState,
    stockQuantity: (variant ?? product).stockQuantity ?? null,
    lowStockThreshold: product.lowStockThreshold ?? null,
  });
}

/** One unit per variant, or one for the product itself when it has none. */
export function sellableUnits(product: Product): SellableUnit[] {
  const id = String(product.id);
  const variants = product.variants ?? [];
  if (variants.length === 0) {
    return [
      {
        id,
        productId: id,
        variantKey: null,
        name: product.title,
        priceCents: product.priceCents ?? null,
        availability: unitAvailability(product, null),
      },
    ];
  }
  return variants.map((v) => ({
    id: `${id}:${v.key}`,
    productId: id,
    variantKey: v.key,
    name: `${product.title} — ${v.label}`,
    priceCents: v.priceCents ?? product.priceCents ?? null,
    availability: unitAvailability(product, v),
  }));
}

/** Product-level status for listings: purchasable if any option is; otherwise the first unit's. */
export function productAvailability(product: Product): Availability {
  const units = sellableUnits(product);
  return (units.find((u) => u.availability.purchasable) ?? units[0]).availability;
}

/** Price range across options, for "from $14.95" listings. */
export function priceRange(product: Product): { min: number; max: number } | null {
  const prices = sellableUnits(product)
    .map((u) => u.priceCents)
    .filter((p): p is number => p !== null);
  return prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null;
}

/** Gift-engine view of each sellable unit. */
export function toBuilderProducts(product: Product): BuilderProduct[] {
  const variants = product.variants ?? [];
  const base = {
    priceApproved: Boolean(product.priceApproved),
    premium: Boolean(product.premium),
    giftTypes: (product.giftTypes ?? []) as GiftType[],
    basketEligible: Boolean(product.basketEligible),
    category: categorySlug(product.category),
    channel: product.channel,
    exclusiveTo: (product.exclusiveTo ?? null) as SpecialCode | null,
    maxPerGift: product.maxPerGift ?? 1,
    fitUnits: product.fitUnits ?? 1,
  };
  const stock = (s: { stockState: "known" | "unknown"; stockQuantity?: number | null }) =>
    s.stockState === "known" && s.stockQuantity !== null && s.stockQuantity !== undefined
      ? ({ state: "known", quantity: s.stockQuantity } as const)
      : ({ state: "unknown" } as const);

  return sellableUnits(product).map((unit) => {
    const variant = unit.variantKey ? variants.find((v) => v.key === unit.variantKey)! : null;
    return {
      ...base,
      id: unit.id,
      name: unit.name,
      priceCents: unit.priceCents,
      stock: stock(variant ?? product),
    };
  });
}

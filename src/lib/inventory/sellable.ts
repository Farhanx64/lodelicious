/**
 * What the shop may sell, with holds, stock age and bills of materials taken into account
 * (INV 01, INV 04, INV 05, D26). Pure: works on copies of the admin Product documents so the
 * existing availability, bag and gift code needs no change. They subtract the in-store reserve
 * themselves, so this layer only lowers the counted quantity by what is held, marks stale stock
 * unknown, and gives a basket with a bill of materials the quantity its components allow.
 */
import type { Product } from "@/payload-types";

import { bomOf, unitKey } from "./units";

type StockFields = { stockState?: "known" | "unknown" | null; stockQuantity?: number | null; stockCountedAt?: string | null };

/** True when freshness isn't checked, or the count is recent enough. A missing date is not fresh. */
export function isFresh(countedAt: string | null | undefined, now: Date, maxAgeMs: number | null): boolean {
  if (maxAgeMs === null) return true;
  if (!countedAt) return false;
  const at = Date.parse(countedAt);
  return Number.isFinite(at) && now.getTime() - at <= maxAgeMs;
}

export type StockView = { state: "known"; quantity: number } | { state: "unknown"; stale: boolean };

/** One unit's counted stock after holds; unknown (or stale) stock is not sellable. */
export function viewStock(stock: StockFields, held: number, now: Date, maxAgeMs: number | null): StockView {
  if (stock.stockState !== "known" || typeof stock.stockQuantity !== "number") return { state: "unknown", stale: false };
  if (!isFresh(stock.stockCountedAt, now, maxAgeMs)) return { state: "unknown", stale: true };
  return { state: "known", quantity: Math.max(0, stock.stockQuantity - held) };
}

export type ViewContext = {
  now: Date;
  maxAgeMs: number | null;
  /** Units held by other checkouts, by `productId` or `productId:variantKey`. */
  holds: ReadonlyMap<string, number>;
  /** Any product by id, for the components of a basket. */
  productById: (id: string) => Product | undefined;
};

export type ProductView = { product: Product; staleUnits: string[] };

/** A copy of `product` as the shop should see it right now. */
export function viewProduct(product: Product, ctx: ViewContext): ProductView {
  const id = String(product.id);
  const stale: string[] = [];
  const heldOf = (unit: string) => ctx.holds.get(unit) ?? 0;

  const components = bomOf(product);
  if (components.length > 0) {
    let units = Number.POSITIVE_INFINITY;
    let unknown = false;
    let anyStale = false;
    for (const part of components) {
      const comp = ctx.productById(part.productId);
      const variant = part.variantKey ? comp?.variants?.find((v) => v.key === part.variantKey) : null;
      const source: StockFields | undefined = part.variantKey ? (variant ?? undefined) : comp;
      if (!comp || !source) {
        unknown = true;
        continue;
      }
      const view = viewStock(source, heldOf(unitKey(part)), ctx.now, ctx.maxAgeMs);
      if (view.state === "unknown") {
        unknown = true;
        anyStale ||= view.stale;
      } else {
        units = Math.min(units, Math.floor(Math.max(0, view.quantity - (comp.onlineReserve ?? 0)) / part.quantity));
      }
    }
    if (anyStale) stale.push(id);
    // The components' own reserves are already out of `units`, so the basket keeps none of its own.
    return {
      product: { ...product, stockState: unknown ? "unknown" : "known", stockQuantity: unknown ? null : units, onlineReserve: 0 },
      staleUnits: stale,
    };
  }

  const hasVariants = (product.variants?.length ?? 0) > 0;
  const own = viewStock(product, heldOf(id), ctx.now, ctx.maxAgeMs);
  if (!hasVariants && own.state === "unknown" && own.stale) stale.push(id);
  const variants = product.variants?.map((variant) => {
    const view = viewStock(variant, heldOf(`${id}:${variant.key}`), ctx.now, ctx.maxAgeMs);
    if (view.state === "unknown" && view.stale) stale.push(`${id}:${variant.key}`);
    return view.state === "known"
      ? { ...variant, stockState: "known" as const, stockQuantity: view.quantity }
      : { ...variant, stockState: "unknown" as const, stockQuantity: null };
  });
  return {
    product: {
      ...product,
      ...(own.state === "known" ? { stockState: "known" as const, stockQuantity: own.quantity } : { stockState: "unknown" as const, stockQuantity: null }),
      ...(variants ? { variants } : {}),
    },
    staleUnits: stale,
  };
}

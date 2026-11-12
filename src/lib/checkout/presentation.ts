import "server-only";

import type { Payload } from "payload";

import type { Category, Media, Product } from "@/payload-types";

import { previewStockEnabled } from "../catalog/preview";
import { priceCart, type PricedCart } from "./cart";
import { applyInventoryView } from "../inventory/view";
import { publishableProductImages } from "../media";
import { productShips } from "../shipping/rates";

/** What the checkout's item cards show beside the name: the first approved photo and the category (D56). */
export type LineLook = { image: Media | null; category: string | null };

// The same visibility rules as every storefront read (D42): published and not hidden, read with override.
const visible = { _status: { equals: "published" } as const, channel: { not_equals: "hidden" } as const };

function look(product: Product): LineLook {
  const category = typeof product.category === "object" && product.category !== null ? (product.category as Category).name : null;
  return { image: publishableProductImages(product.images)[0] ?? null, category: category ?? null };
}

/** Photos and categories for the products in the bag, by product id. One read; prices and stock still come from the bag. */
export async function bagLineLooks(payload: Payload, productIds: readonly string[]): Promise<Map<string, LineLook>> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return new Map();
  const { docs } = await payload.find({
    collection: "products",
    where: { and: [{ id: { in: ids } }, { _status: visible._status }, { channel: visible.channel }] },
    limit: ids.length,
    depth: 1,
    overrideAccess: true,
  });
  return new Map((docs as Product[]).map((p) => [String(p.id), look(p)]));
}

export type AddOn = { unitId: string; title: string; blurb: string | null; priceCents: number; image: Media | null };

/**
 * One product to offer as "You might also like" at checkout (D56): a featured product, not already
 * in the bag, with a single option, an approved price and stock to sell, and that can ship (so adding
 * it never takes shipping away from an order that has it). Null when nothing fits.
 */
export async function suggestAddOn(payload: Payload, bag: Pick<PricedCart, "lines">): Promise<AddOn | null> {
  const inBag = new Set(bag.lines.map((l) => l.productId));
  const { docs } = await payload.find({
    collection: "products",
    where: { and: [{ _status: visible._status }, { channel: visible.channel }, { featured: { equals: true } }] },
    sort: "title",
    limit: 24,
    depth: 1,
    overrideAccess: true,
  });
  const candidates = (docs as Product[]).filter((p) => !inBag.has(String(p.id)) && (p.variants ?? []).length === 0 && productShips(p));
  if (candidates.length === 0) return null;
  const { products } = await applyInventoryView(payload, candidates);
  for (const product of products) {
    const line = priceCart([{ unitId: String(product.id), quantity: 1 }], [product], { previewStock: previewStockEnabled(), taxClasses: [], defaultTaxClassId: null }).payable[0];
    if (!line || !line.priceApproved) continue;
    return { unitId: line.unitId, title: line.title, blurb: product.shortDescription ?? null, priceCents: line.unitPriceCents, image: look(product).image };
  }
  return null;
}

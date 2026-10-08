import type { Payload } from "payload";

import type { Category, Product } from "@/payload-types";

import { getGiftSettings } from "../gifts/load";
import type { BuilderProduct, GiftSettings } from "../gifts/types";
import { applyInventoryView, type InventoryConfig } from "../inventory/view";
import { publishableProductImages } from "../media";
import { previewStockEnabled } from "./preview";
import { toBuilderProducts } from "./product";

/** What the builder UI shows for each selectable unit (never used for rules). */
export type BuilderDisplay = {
  id: string;
  title: string;
  brand: string | null;
  categoryName: string;
  sizeLabel: string | null;
  imageUrl: string | null;
  imageAlt: string;
};

export type BuilderCatalog = {
  settings: GiftSettings;
  products: BuilderProduct[];
  display: BuilderDisplay[];
  /** True when staging is treating uncounted stock as available for review. */
  previewStock: boolean;
};

export type BuilderStockOptions = {
  now?: Date;
  /** A checkout's own holds don't count against it. */
  exceptOwner?: string | null;
  config?: InventoryConfig;
};

/**
 * Core loader, usable from tests and services that already hold a Payload instance. Stock is what
 * the shop can sell now: other customers' holds are subtracted, counts older than the allowed age
 * are "stale" (unavailable), and a curated basket with contents is as many as its parts allow.
 */
export async function loadBuilderCatalogFrom(payload: Payload, opts: BuilderStockOptions = {}): Promise<BuilderCatalog> {
  const [settings, { docs }] = await Promise.all([
    getGiftSettings(payload),
    payload.find({
      collection: "products",
      where: {
        and: [
          { _status: { equals: "published" } },
          { channel: { not_equals: "hidden" } },
          { channel: { equals: "online" } },
          { basketEligible: { equals: true } },
        ],
      },
      sort: "title",
      limit: 500,
      depth: 2,
      // Products are staff-only over REST (A04, D42), so the storefront states its own rules
      // above (published, online, basket-eligible) and reads with override.
      overrideAccess: true,
    }),
  ]);

  const previewStock = previewStockEnabled();
  const products: BuilderProduct[] = [];
  const display: BuilderDisplay[] = [];
  const seen = await applyInventoryView(payload, docs as Product[], opts);

  for (const doc of seen.products) {
    const category = typeof doc.category === "object" ? (doc.category as Category) : null;
    const image = publishableProductImages(doc.images)[0] ?? null;
    for (const built of toBuilderProducts(doc)) {
      const unit = seen.staleUnits.has(built.id) ? { ...built, stock: { state: "stale" as const } } : built;
      const shown = previewStock && unit.stock.state !== "known" ? { ...unit, stock: { state: "known" as const, quantity: 99 } } : unit;
      // The builder never needs more than the most one gift can hold, and the exact shelf count is not the customer's business (A04, D42).
      products.push(shown.stock.state === "known" ? { ...shown, stock: { state: "known", quantity: Math.min(shown.stock.quantity, shown.maxPerGift) } } : shown);
      display.push({
        id: unit.id,
        title: unit.name,
        brand: doc.brand ?? null,
        categoryName: category?.name ?? "",
        sizeLabel: doc.sizeLabel ?? null,
        imageUrl: image ? (image.sizes?.thumb?.url ?? image.url ?? null) : null,
        imageAlt: image?.alt ?? "",
      });
    }
  }

  return { settings, products, display, previewStock };
}

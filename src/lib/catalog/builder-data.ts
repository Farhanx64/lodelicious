import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";

import type { Category, Media, Product } from "@/payload-types";

import { getGiftSettings } from "../gifts/load";
import type { BuilderProduct, GiftSettings } from "../gifts/types";
import { isImagePublishable } from "../media";
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

export async function loadBuilderCatalog(): Promise<BuilderCatalog> {
  const payload = await getPayload({ config });
  const [settings, { docs }] = await Promise.all([
    getGiftSettings(payload),
    payload.find({
      collection: "products",
      where: {
        and: [
          { _status: { equals: "published" } },
          { channel: { equals: "online" } },
          { basketEligible: { equals: true } },
        ],
      },
      sort: "title",
      limit: 500,
      depth: 2,
      overrideAccess: false,
    }),
  ]);

  const previewStock = previewStockEnabled();
  const products: BuilderProduct[] = [];
  const display: BuilderDisplay[] = [];

  for (const doc of docs as Product[]) {
    const category = typeof doc.category === "object" ? (doc.category as Category) : null;
    const media = doc.images?.[0]?.image;
    const image = typeof media === "object" && isImagePublishable(media as Media) ? (media as Media) : null;
    for (const unit of toBuilderProducts(doc)) {
      products.push(previewStock && unit.stock.state !== "known" ? { ...unit, stock: { state: "known", quantity: 99 } } : unit);
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

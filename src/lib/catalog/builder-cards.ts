/**
 * The Build a Basket picker shows one card per product. A product sold in options (dark or milk
 * pretzels, window or classic Princess box) used to appear once per option, each card with the same
 * photo and nearly the same name, so customers saw it twice and could add "it" twice.
 * Framework-free, for the loader, the client and tests.
 */
import type { Category, Media, Product } from "@/payload-types";

import { isImagePublishable, publishableProductImages } from "../media";
import { sellableUnits } from "./product";

/** What the builder UI shows for each selectable unit (never used for rules). */
export type BuilderDisplay = {
  /** The sellable unit: `${productId}` or `${productId}:${variantKey}`. */
  id: string;
  /** The product it belongs to. The picker shows one card per product, with its options inside. */
  productId: string;
  /** The product's own title, without the option. */
  productTitle: string;
  /** The option's label ("Dark chocolate"), or null when the product has no options. */
  optionLabel: string | null;
  /** The unit's full name ("Chocolate Pretzels — Dark chocolate"), used in the basket summary and preview. */
  title: string;
  brand: string | null;
  categoryName: string;
  sizeLabel: string | null;
  imageUrl: string | null;
  imageAlt: string;
};

export type BuilderCard = {
  productId: string;
  title: string;
  /** The product's sellable units in catalog order; one entry when it has no options. */
  options: BuilderDisplay[];
};

/** One display entry per sellable unit of a product. An option with its own photo shows that photo. */
export function builderDisplay(doc: Product): BuilderDisplay[] {
  const category = typeof doc.category === "object" ? (doc.category as Category) : null;
  const image = publishableProductImages(doc.images)[0] ?? null;
  return sellableUnits(doc).map((unit) => {
    const variant = unit.variantKey ? (doc.variants ?? []).find((v) => v.key === unit.variantKey) : undefined;
    const own = typeof variant?.image === "object" && variant.image !== null && isImagePublishable(variant.image) ? (variant.image as Media) : null;
    const photo = own ?? image;
    return {
      id: unit.id,
      productId: unit.productId,
      productTitle: doc.title.trim(),
      optionLabel: variant?.label ?? null,
      title: unit.name.trim(),
      brand: doc.brand ?? null,
      categoryName: category?.name ?? "",
      sizeLabel: doc.sizeLabel ?? null,
      imageUrl: photo ? (photo.sizes?.thumb?.url ?? photo.url ?? null) : null,
      imageAlt: photo?.alt ?? "",
    };
  });
}

/** Groups display units into one card per product, keeping first-seen order and dropping repeated units. */
export function builderCards(display: readonly BuilderDisplay[]): BuilderCard[] {
  const cards = new Map<string, BuilderCard>();
  const seen = new Set<string>();
  for (const d of display) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    const card = cards.get(d.productId);
    if (card) card.options.push(d);
    else cards.set(d.productId, { productId: d.productId, title: d.productTitle, options: [d] });
  }
  return [...cards.values()];
}

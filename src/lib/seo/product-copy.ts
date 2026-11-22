/**
 * Product page copy built only from catalog data (D69): the meta description, a short FAQ, the
 * "pairs well with" picks and the occasion links. Nothing here states an ingredient, allergen,
 * size or price the product record doesn't hold; where data is missing the copy stays general.
 */
import type { Product } from "@/payload-types";

import { metaText } from "./index";
import { OCCASIONS, type Occasion } from "./occasions";

type ProductText = Pick<Product, "title" | "slug" | "brand" | "shortDescription" | "sizeLabel" | "channel" | "pickup" | "shippable" | "perishable" | "basketEligible" | "giftTypes">;

/** The category's name as a noun after the product, e.g. "Fudge" → "fudge". */
const noun = (category: string | null | undefined) => (category ? category.toLowerCase() : null);

/** Unique per product: its own description (or title, brand, size and category), then how to get it. */
export function productMetaDescription(p: ProductText, categoryName: string | null | undefined, fromCents: number | null): string | undefined {
  const own = metaText(p.shortDescription, 105);
  const kind = noun(categoryName);
  const lead =
    own ??
    `${p.title}${p.sizeLabel ? ` (${p.sizeLabel})` : ""}${p.brand && !p.title.includes(p.brand) ? ` by ${p.brand}` : ""}${kind ? `, ${kind}` : ""} from Lodelicious Gifts & Sweets.`;
  const price = fromCents !== null ? ` From $${(fromCents / 100).toFixed(2)}.` : "";
  const how =
    p.channel === "inquiry_only"
      ? " Order by inquiry from our Plymouth, MA shop."
      : p.shippable
        ? " Pickup in Plymouth, MA or shipping in the US."
        : " Pickup at our shop in Plymouth, MA.";
  return metaText(`${lead}${price}${how}`);
}

/** Short, true answers from the product's own settings. `{address}` is the shop's street and town. */
export function productFaqs(p: ProductText, address: string): { q: string; a: string }[] {
  const faqs: { q: string; a: string }[] = [];
  if (p.channel === "inquiry_only") {
    faqs.push({ q: "How do I order this?", a: `Ask us about it by message or phone and we'll confirm what's available. Pick it up at ${address}.` });
  } else if (p.pickup !== false) {
    faqs.push({ q: "Can I pick this up in Plymouth?", a: `Yes. Choose pickup at checkout and collect it at ${address}.` });
  }
  if (p.channel !== "inquiry_only") {
    faqs.push(
      p.shippable
        ? { q: "Can you ship it?", a: "Yes, within the US. Shipping is priced at checkout from the ZIP code and the weight of the order." }
        : { q: "Can you ship it?", a: p.perishable ? "No. It's a fresh item, so it's for pickup only." : "Not this item: it's for pickup only." },
    );
  }
  if (p.basketEligible) {
    faqs.push({ q: "Can I add it to a gift basket?", a: "Yes. Choose it when you build a basket online, and add a gift message if you like." });
  }
  return faqs;
}

/** Which categories go well with which, for the "pairs well with" picks. */
const PAIRINGS: Readonly<Record<string, readonly string[]>> = {
  chocolate: ["gift-add-ons", "fudge", "candy"],
  fudge: ["chocolate", "candy"],
  candy: ["chocolate", "gift-add-ons"],
  "fresh-treats": ["chocolate", "candy"],
  "baby-gifts": ["gift-add-ons"],
  "gift-add-ons": ["chocolate", "baby-gifts"],
  "gift-baskets": ["gift-add-ons", "chocolate"],
};

export const pairedCategories = (categorySlug: string | null | undefined): readonly string[] => (categorySlug ? (PAIRINGS[categorySlug] ?? ["chocolate"]) : []);

/** A small stable hash, so each product page shows its own picks but the same ones every time. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Up to `limit` products from the paired categories, one category at a time in turn, never the
 * product itself. `pools` is the candidates per category, already filtered to what customers see.
 */
export function pickPairings<T extends { id: number | string; slug?: string | null }>(self: { id: number | string; slug?: string | null }, pools: readonly (readonly T[])[], limit = 4): T[] {
  const seed = hash(self.slug ?? String(self.id));
  const rotated = pools.map((pool) => {
    const list = pool.filter((p) => p.id !== self.id);
    const start = list.length ? seed % list.length : 0;
    return [...list.slice(start), ...list.slice(0, start)];
  });
  const out: T[] = [];
  for (let round = 0; out.length < limit && rotated.some((l) => l.length > round); round++) {
    for (const list of rotated) if (list[round] && out.length < limit) out.push(list[round]);
  }
  return out;
}

/** Occasion pages this product belongs on: named in a basket list, by category, gift type or wording. */
export function occasionsFor(p: ProductText, categorySlug: string | null | undefined, limit = 4): Occasion[] {
  const text = [p.title, p.brand, p.shortDescription].filter(Boolean).join(" ");
  return OCCASIONS.filter(
    (o) =>
      (p.slug && o.basketSlugs.includes(p.slug)) ||
      (categorySlug && o.categorySlugs?.includes(categorySlug)) ||
      (o.slug === "sympathy" && p.giftTypes?.includes("sympathy")) ||
      (o.match?.test(text) ?? false),
  ).slice(0, limit);
}

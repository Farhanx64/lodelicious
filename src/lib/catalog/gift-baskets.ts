/**
 * How the /gift-baskets page groups the curated baskets (D38). The map below sets both the group
 * and the order inside it: the catalog lists products by title, which would put "Extra Large"
 * before "Small".
 *
 * Staff can add more baskets in /admin (D24). A product in the gift-baskets category that is not
 * named here is never dropped: it lands in a final "More gift baskets" group.
 */

export const GIFT_BASKET_CATEGORY = "gift-baskets";

export type GiftBasketGroupKey = "everyday" | "birthday" | "savory" | "sympathy";

type GroupDef = {
  key: GiftBasketGroupKey;
  title: string;
  /** Wording taken from the owner's basket chart (data/source/basket-chart.csv). */
  blurb: string;
  /** Product slugs in display order. */
  slugs: readonly string[];
};

export const GIFT_BASKET_GROUPS: readonly GroupDef[] = [
  {
    key: "everyday",
    title: "Everyday gift baskets",
    blurb: "From Small to Extra Large. Open a basket to see what it typically includes.",
    slugs: ["small-gift-basket", "medium-gift-basket", "large-gift-basket", "extra-large-gift-basket"],
  },
  {
    key: "birthday",
    title: "Birthday",
    blurb: "Typically includes sweet & savory treats, gourmet snacks, chocolates, a birthday card and festive birthday letters.",
    slugs: ["large-birthday-basket"],
  },
  {
    key: "savory",
    title: "Savory",
    blurb: "Typically includes cheese, crackers, an assortment of nuts, olives, pretzels and salami.",
    slugs: ["large-savory-basket"],
  },
  {
    key: "sympathy",
    title: "Sympathy",
    blurb: "Typically includes premium chocolates such as Phillips Chocolate, fresh fruit, savory crackers and a variety of treats.",
    slugs: ["small-sympathy-basket", "medium-sympathy-basket", "large-sympathy-basket"],
  },
];

export type GiftBasketGroup<T> = { key: GiftBasketGroupKey | "other"; title: string; blurb: string | null; products: T[] };

/** Non-empty groups in page order, with unmapped products in a last group. */
export function groupGiftBaskets<T extends { slug?: string | null }>(products: readonly T[]): GiftBasketGroup<T>[] {
  const bySlug = new Map<string, T>();
  const unmapped: T[] = [];
  const known = new Set(GIFT_BASKET_GROUPS.flatMap((g) => g.slugs));
  for (const p of products) {
    if (p.slug && known.has(p.slug)) bySlug.set(p.slug, p);
    else unmapped.push(p);
  }

  const groups: GiftBasketGroup<T>[] = GIFT_BASKET_GROUPS.map((g) => ({
    key: g.key,
    title: g.title,
    blurb: g.blurb,
    products: g.slugs.flatMap((slug) => bySlug.get(slug) ?? []),
  }));
  if (unmapped.length > 0) groups.push({ key: "other", title: "More gift baskets", blurb: null, products: unmapped });
  return groups.filter((g) => g.products.length > 0);
}

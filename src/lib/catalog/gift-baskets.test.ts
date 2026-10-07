import { describe, expect, it } from "vitest";

import { GIFT_BASKET_GROUPS, groupGiftBaskets } from "./gift-baskets";

const p = (slug: string | null) => ({ slug, id: slug ?? "none" });

describe("groupGiftBaskets (D38)", () => {
  it("orders groups and baskets by the explicit map, not by the order they arrive in", () => {
    // The catalog lists by title, which puts "Extra Large" before "Small".
    const arrival = [
      "small-sympathy-basket",
      "extra-large-gift-basket",
      "large-savory-basket",
      "small-gift-basket",
      "large-sympathy-basket",
      "large-birthday-basket",
      "medium-gift-basket",
      "large-gift-basket",
      "medium-sympathy-basket",
    ];
    const groups = groupGiftBaskets(arrival.map(p));
    expect(groups.map((g) => g.key)).toEqual(["everyday", "birthday", "savory", "sympathy"]);
    expect(groups.map((g) => g.products.map((x) => x.slug))).toEqual([
      ["small-gift-basket", "medium-gift-basket", "large-gift-basket", "extra-large-gift-basket"],
      ["large-birthday-basket"],
      ["large-savory-basket"],
      ["small-sympathy-basket", "medium-sympathy-basket", "large-sympathy-basket"],
    ]);
  });

  it("hides empty groups", () => {
    expect(groupGiftBaskets([p("large-savory-basket")]).map((g) => g.key)).toEqual(["savory"]);
  });

  it("never drops a basket staff added in /admin: it goes in a last group", () => {
    const groups = groupGiftBaskets([p("holiday-basket"), p("small-gift-basket"), p(null)]);
    expect(groups.map((g) => g.key)).toEqual(["everyday", "other"]);
    expect(groups[1]).toMatchObject({ title: "More gift baskets", blurb: null });
    expect(groups[1].products.map((x) => x.id)).toEqual(["holiday-basket", "none"]);
  });

  it("returns nothing for an empty category", () => {
    expect(groupGiftBaskets([])).toEqual([]);
  });

  it("maps each slug once", () => {
    const slugs = GIFT_BASKET_GROUPS.flatMap((g) => g.slugs);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toHaveLength(9);
  });
});

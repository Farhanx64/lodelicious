import { describe, expect, it } from "vitest";

import { occasionsFor, pickPairings, productFaqs, productMetaDescription } from "./product-copy";

const base = { title: "Turtles 9pc Assortment Box", slug: "turtles", brand: "Phillips Chocolates", shortDescription: null, sizeLabel: null, channel: "online", pickup: true, shippable: false, perishable: false, basketEligible: false, giftTypes: [] } as never;
const withPatch = (patch: Record<string, unknown>) => ({ ...(base as object), ...patch }) as never;

describe("product copy (D69)", () => {
  it("writes a description from the record, naming only real ways to get it", () => {
    const d = productMetaDescription(base, "Chocolates", 1899)!;
    expect(d).toContain("Turtles 9pc Assortment Box by Phillips Chocolates, chocolates");
    expect(d).toContain("From $18.99.");
    expect(d).toContain("Pickup at our shop in Plymouth, MA.");
    expect(d).not.toMatch(/ship|DoorDash/i);
    expect(productMetaDescription(withPatch({ shippable: true }), null, null)).toContain("shipping in the US");
    expect(productMetaDescription(withPatch({ channel: "inquiry_only" }), null, null)).toContain("by inquiry");
  });

  it("never uses placeholder text as the description", () => {
    const d = productMetaDescription(withPatch({ shortDescription: "From the allergen chart; price, size and photo still needed." }), "Fudge", null)!;
    expect(d).not.toMatch(/still needed/);
    expect(d.length).toBeLessThanOrEqual(159);
  });

  it("answers from the product's own settings", () => {
    const pickupOnly = productFaqs(withPatch({ perishable: true }), "24 Manomet Point Rd., Plymouth, MA 02360");
    expect(pickupOnly.map((f) => f.q)).toEqual(["Can I pick this up in Plymouth?", "Can you ship it?"]);
    expect(pickupOnly[1].a).toMatch(/fresh item/);
    expect(productFaqs(withPatch({ shippable: true, basketEligible: true }), "x").map((f) => f.a).join(" ")).toMatch(/within the US[\s\S]*build a basket/);
    expect(productFaqs(withPatch({ channel: "inquiry_only" }), "x").map((f) => f.q)).toEqual(["How do I order this?"]);
  });

  it("picks pairings in turn from each category, never the product itself, stable per product", () => {
    const a = [1, 2, 3].map((id) => ({ id, slug: `a${id}` }));
    const b = [4, 5].map((id) => ({ id, slug: `b${id}` }));
    const picks = pickPairings({ id: 1, slug: "a1" }, [a, b], 4);
    expect(picks).toHaveLength(4);
    expect(picks.some((p) => p.id === 1)).toBe(false);
    expect(pickPairings({ id: 1, slug: "a1" }, [a, b], 4)).toEqual(picks);
  });

  it("links products to the occasions they belong to", () => {
    expect(occasionsFor(withPatch({ title: "Baby Ceramic Bowl" }), "baby-gifts").map((o) => o.slug)).toContain("new-baby");
    expect(occasionsFor(withPatch({ slug: "small-sympathy-basket", title: "Small Sympathy Basket" }), "gift-baskets")[0].slug).toBe("sympathy");
  });
});

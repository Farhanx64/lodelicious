import { describe, expect, it } from "vitest";

import { faqJsonLd, jsonLdText, metaText, productJsonLd, siteUrlFrom, storeJsonLd } from "./index";
import { AREAS, areaBySlug } from "./areas";
import { CATEGORY_COPY, CATEGORY_PAGES_ELSEWHERE, categoryHref } from "./categories";
import { OCCASIONS, occasionBySlug } from "./occasions";

describe("seo helpers (D68)", () => {
  it("uses the first address when NEXT_PUBLIC_SITE_URL lists several", () => {
    expect(siteUrlFrom("https://shoplodelicious.com,https://www.shoplodelicious.com")).toBe("https://shoplodelicious.com");
    expect(siteUrlFrom(" https://a.test/ ")).toBe("https://a.test");
    expect(siteUrlFrom(undefined)).toBe("https://shoplodelicious.com");
  });

  it("never ships placeholder meta text and trims at a word", () => {
    expect(metaText("From the allergen chart; price, size and photo still needed.")).toBeUndefined();
    const long = "word ".repeat(60);
    const out = metaText(long)!;
    expect(out.length).toBeLessThanOrEqual(159);
    expect(out.endsWith("…")).toBe(true);
  });

  it("builds the store with its address parts", () => {
    const s = storeJsonLd({ name: "Lodelicious", street: "24 Manomet Point Rd", locality: "Plymouth, MA 02360", phone: "(774) 283-4676", email: null, tagline: null, doordashUrl: null, googleReviewUrl: null } as never);
    expect(s.address).toMatchObject({ streetAddress: "24 Manomet Point Rd", addressLocality: "Plymouth", addressRegion: "MA", postalCode: "02360" });
  });

  it("uses a single Offer for one price and an AggregateOffer for a range", () => {
    const p = { title: "Bar", slug: "bar", brand: "Phillips", shortDescription: "Dark chocolate." };
    expect((productJsonLd(p, { lowCents: 500, highCents: 500, inStock: true }).offers as Record<string, unknown>)["@type"]).toBe("Offer");
    expect((productJsonLd(p, { lowCents: 500, highCents: 900, inStock: false }).offers as Record<string, unknown>)).toMatchObject({ "@type": "AggregateOffer", lowPrice: "5.00", highPrice: "9.00" });
    expect(productJsonLd(p, null).offers).toBeUndefined();
  });

  it("escapes < so text can't close the script tag", () => {
    expect(jsonLdText(faqJsonLd([{ q: "</script>", a: "x" }]))).not.toContain("</script>");
  });

  it("has unique occasion slugs, each with FAQs", () => {
    expect(new Set(OCCASIONS.map((o) => o.slug)).size).toBe(OCCASIONS.length);
    for (const o of OCCASIONS) expect(o.faqs.length).toBeGreaterThan(0);
    expect(occasionBySlug("sympathy")?.h1).toBe("Sympathy Gift Baskets");
    expect(occasionBySlug("nope")).toBeNull();
  });

  it("covers the round-2 occasions (D69)", () => {
    for (const slug of ["mothers-day", "valentines-day", "new-baby", "get-well", "anniversary"]) expect(occasionBySlug(slug)?.faqs.length).toBeGreaterThan(0);
    expect(occasionBySlug("new-baby")?.categorySlugs).toContain("baby-gifts");
  });

  it("has one page per service area, each linking to real occasions (D69)", () => {
    expect(new Set(AREAS.map((a) => a.slug)).size).toBe(AREAS.length);
    for (const a of AREAS) {
      expect(a.faqs.length).toBeGreaterThan(0);
      for (const o of a.occasions) expect(occasionBySlug(o), `${a.slug} → ${o}`).not.toBeNull();
    }
    expect(areaBySlug("plymouth-ma")?.faqs.some((f) => f.a.includes("{address}"))).toBe(true);
  });

  it("category copy links to real occasions and sends baskets and baby gifts to their own pages (D69)", () => {
    for (const c of CATEGORY_COPY) {
      expect(CATEGORY_PAGES_ELSEWHERE[c.slug]).toBeUndefined();
      for (const o of c.occasions) expect(occasionBySlug(o), `${c.slug} → ${o}`).not.toBeNull();
    }
    expect(categoryHref("gift-baskets")).toBe("/gift-baskets");
    expect(categoryHref("fudge")).toBe("/shop/category/fudge");
  });

  it("never promises delivery dates, fees or times in landing copy (D68, D69)", () => {
    const text = JSON.stringify([OCCASIONS.map((o) => ({ ...o, match: null })), AREAS.map((a) => ({ ...a, match: null })), CATEGORY_COPY]);
    expect(text).not.toMatch(/same[- ]day|next[- ]day|free (delivery|shipping)|within \d+ (hours|days)|\$\d/i);
    expect(text).not.toMatch(/placeholder|lorem|still needed|TODO/i);
  });
});

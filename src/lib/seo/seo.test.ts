import { describe, expect, it } from "vitest";

import { faqJsonLd, jsonLdText, metaText, productJsonLd, siteUrlFrom, storeJsonLd } from "./index";
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
});

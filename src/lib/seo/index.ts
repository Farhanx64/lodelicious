/**
 * Search basics (D68): one canonical host, structured data (schema.org JSON-LD) and title wording
 * that names what we sell and where. Built from the SEO research of 2026-11-20.
 */
import type { Product, StoreSetting } from "@/payload-types";

/** The one canonical address. http:// and www. redirect here (next.config.ts). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://shoplodelicious.com").replace(/\/+$/, "");
export const CANONICAL_HOST = new URL(SITE_URL).host;

export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Towns we serve, for areaServed and the delivery page. Pickup is in Manomet, Plymouth. */
export const SERVICE_TOWNS = ["Plymouth", "Manomet", "Kingston", "Duxbury", "Carver", "Plympton", "Bourne", "Sandwich"] as const;

type Json = Record<string, unknown>;

/** Text for a meta description: one line, no more than ~160 characters, cut at a word. */
export function metaText(text: string | null | undefined, max = 158): string | undefined {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t || /still needed|placeholder|lorem/i.test(t)) return undefined;
  if (t.length <= max) return t;
  return `${t.slice(0, t.lastIndexOf(" ", max - 1) || max - 1).replace(/[,;:.\s]+$/, "")}…`;
}

/** `Manomet, Plymouth, MA 02360` → its parts, best effort. */
function addressParts(locality: string) {
  const m = locality.match(/^(.*?),?\s*([A-Z]{2})\s+(\d{5})/);
  if (!m) return { addressLocality: locality };
  const town = m[1].split(",").map((s) => s.trim()).filter(Boolean);
  return { addressLocality: town[town.length - 1] ?? m[1], addressRegion: m[2], postalCode: m[3] };
}

/** The shop, for every page: a confectionery and gift-basket store in Plymouth, MA. */
export function storeJsonLd(store: Pick<StoreSetting, "name" | "street" | "locality" | "phone" | "email" | "tagline" | "doordashUrl" | "googleReviewUrl">): Json {
  return {
    "@context": "https://schema.org",
    "@type": ["ConfectioneryStore", "Store"],
    "@id": `${SITE_URL}/#store`,
    name: store.name,
    description: store.tagline || "Gift baskets, chocolates, fudge and candy from a family-owned shop in Plymouth, Massachusetts.",
    url: SITE_URL,
    logo: absoluteUrl("/brand/logo-512.png"),
    image: absoluteUrl("/brand/logo-1024.png"),
    telephone: store.phone || undefined,
    email: store.email || undefined,
    address: { "@type": "PostalAddress", streetAddress: store.street, ...addressParts(store.locality ?? ""), addressCountry: "US" },
    areaServed: SERVICE_TOWNS.map((name) => ({ "@type": "City", name: `${name}, MA` })),
    priceRange: "$$",
    sameAs: [store.googleReviewUrl, store.doordashUrl].filter(Boolean),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

export function faqJsonLd(faqs: readonly { q: string; a: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

type ProductLike = Pick<Product, "title" | "slug" | "brand" | "shortDescription"> & { imageUrl?: string | null };

/** A product with its price range and stock, when the price is approved. */
export function productJsonLd(p: ProductLike, offer: { lowCents: number; highCents: number; inStock: boolean } | null): Json {
  const url = absoluteUrl(`/shop/${p.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    url,
    description: metaText(p.shortDescription, 500),
    image: p.imageUrl ? [p.imageUrl.startsWith("http") ? p.imageUrl : absoluteUrl(p.imageUrl)] : undefined,
    brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
    offers: offer
      ? {
          "@type": offer.lowCents === offer.highCents ? "Offer" : "AggregateOffer",
          url,
          priceCurrency: "USD",
          ...(offer.lowCents === offer.highCents
            ? { price: (offer.lowCents / 100).toFixed(2) }
            : { lowPrice: (offer.lowCents / 100).toFixed(2), highPrice: (offer.highCents / 100).toFixed(2) }),
          availability: offer.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          seller: { "@id": `${SITE_URL}/#store` },
        }
      : undefined,
  };
}

/** Serialised for a <script type="application/ld+json">; `<` escaped so text can't close the tag. */
export const jsonLdText = (data: Json | Json[]) => JSON.stringify(data).replace(/</g, "\\u003c");

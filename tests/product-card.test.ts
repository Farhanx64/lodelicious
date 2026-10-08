/**
 * Product cards never present an unapproved price as a real one, on any listing (A06, D41).
 * An approved price keeps the usual display.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProductCard } from "@/components/catalog/ProductCard";
import type { Media, Product } from "@/payload-types";

function basket(patch: Partial<Product> = {}): Product {
  return {
    id: 21,
    title: "Large Gift Basket",
    slug: "large-gift-basket",
    category: 8,
    sizeLabel: "12–14 items · 18 in basket",
    channel: "inquiry_only",
    priceCents: 13995,
    priceApproved: false,
    stockState: "unknown",
    nutFree: "unknown",
    vegan: "unknown",
    images: [],
    updatedAt: "",
    createdAt: "",
    ...patch,
  } as Product;
}

const render = (product: Product) => renderToStaticMarkup(createElement(ProductCard, { product }));

describe("ProductCard", () => {
  it("says the price is to be confirmed, and never shows the number, until the price is approved", () => {
    const html = render(basket());
    expect(html).not.toContain("139.95");
    expect(html).toContain("Price to be confirmed");
    expect(html).toContain("Available by inquiry");
    expect(html).toContain("Photo coming soon");
    expect(html).toContain('href="/shop/large-gift-basket"');
    expect(html).toContain("12–14 items · 18 in basket");
  });

  it("hides an unapproved price for the baby ceramics too (their assumed $14.95 and $19.95)", () => {
    const html = render(
      basket({ title: "Baby Ceramic Shoes", slug: "baby-ceramic-shoes", channel: "online", priceCents: 1495, variants: [{ key: "pink", label: "Pink", priceCents: 1995, stockState: "unknown" }] }),
    );
    expect(html).not.toMatch(/14\.95|19\.95/);
    expect(html).toContain("Price to be confirmed");
  });

  it("shows the price once it is approved", () => {
    const html = render(basket({ priceApproved: true }));
    expect(html).toContain("$139.95");
    expect(html).not.toContain("Price to be confirmed");
  });

  it("shows 'From' for an approved product whose options differ in price", () => {
    const html = render(
      basket({ priceApproved: true, channel: "online", priceCents: 1495, variants: [{ key: "pink", label: "Pink", stockState: "unknown" }, { key: "blue", label: "Blue", priceCents: 1995, stockState: "unknown" }] }),
    );
    expect(html).toContain("From $14.95");
  });

  it("keeps 'Price on request' for an approved product with no price at all", () => {
    expect(render(basket({ priceApproved: true, priceCents: null }))).toContain("Price on request");
  });

  it("gives the card photo an empty alt, so the title is not read twice, and hides the placeholder tile (A18)", () => {
    const media = { id: 3, alt: "Large Gift Basket", approvedForLaunch: true, url: "/api/media/file/a.jpg", sizes: {}, updatedAt: "", createdAt: "" } as unknown as Media;
    const withPhoto = render(basket({ images: [{ image: media }] }));
    expect(withPhoto).toContain('alt=""');
    expect(withPhoto).not.toContain('alt="Large Gift Basket"');
    expect(render(basket())).toMatch(/aria-hidden="true"[^>]*>Photo coming soon/);
  });
});

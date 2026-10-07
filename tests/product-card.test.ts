/**
 * Product cards never present an unapproved price as a real one on /gift-baskets (D38), and keep
 * the long-standing display everywhere else.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProductCard } from "@/components/catalog/ProductCard";
import type { Product } from "@/payload-types";

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

const render = (product: Product, hideUnapprovedPrice?: boolean) =>
  renderToStaticMarkup(createElement(ProductCard, { product, hideUnapprovedPrice }));

describe("ProductCard", () => {
  it("can hide a price that has not been approved, and says it is by inquiry with no photo yet", () => {
    const html = render(basket(), true);
    expect(html).not.toContain("139.95");
    expect(html).toContain("Price on request");
    expect(html).toContain("Available by inquiry");
    expect(html).toContain("Photo coming soon");
    expect(html).toContain('href="/shop/large-gift-basket"');
    expect(html).toContain("12–14 items · 18 in basket");
  });

  it("shows the price once it is approved", () => {
    const html = render(basket({ priceApproved: true }), true);
    expect(html).toContain("$139.95");
    expect(html).not.toContain("Price on request");
  });

  it("keeps today's display for other listings unless asked (the ceramics' assumed prices are unchanged)", () => {
    expect(render(basket())).toContain("$139.95");
    expect(render(basket(), false)).toContain("$139.95");
  });
});

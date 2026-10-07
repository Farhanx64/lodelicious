/**
 * /gift-baskets (D38): one h1, the baskets in groups, no unapproved price, the two calls to action,
 * and an empty state. Data access is mocked; the page and ProductCard are rendered for real.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Product, StoreSetting } from "@/payload-types";

const mocks = vi.hoisted(() => ({ products: [] as unknown[] }));

vi.mock("@/src/lib/catalog/queries", () => ({ listProducts: vi.fn(async () => mocks.products) }));
vi.mock("@/src/lib/store", () => ({
  getStoreSettings: vi.fn(async () => ({
    phone: "(774) 283-4676",
    street: "24 Manomet Point Rd.",
    locality: "Plymouth, MA 02360",
    allergyNotice: "",
  })) as unknown as () => Promise<StoreSetting>,
}));

import GiftBasketsPage, { metadata } from "@/app/(frontend)/gift-baskets/page";

function basket(slug: string, title: string, patch: Partial<Product> = {}): Product {
  return {
    id: slug,
    title,
    slug,
    category: 8,
    sizeLabel: "6–8 items · 12 in basket",
    channel: "inquiry_only",
    priceCents: 7995,
    priceApproved: false,
    stockState: "unknown",
    nutFree: "unknown",
    vegan: "unknown",
    images: [],
    updatedAt: "",
    createdAt: "",
    ...patch,
  } as unknown as Product;
}

const render = async () => renderToStaticMarkup(await GiftBasketsPage());

beforeEach(() => {
  mocks.products = [];
});

describe("/gift-baskets", () => {
  it("has a title and one h1", async () => {
    expect(metadata.title).toBe("Gift Baskets");
    mocks.products = [basket("small-gift-basket", "Small Gift Basket")];
    expect((await render()).match(/<h1[ >]/g)).toHaveLength(1);
  });

  it("groups the baskets, does not show an unapproved price, and says they are by inquiry", async () => {
    mocks.products = [
      basket("small-sympathy-basket", "Small Sympathy Basket"),
      basket("large-birthday-basket", "Large Birthday Basket"),
      basket("small-gift-basket", "Small Gift Basket"),
      basket("holiday-basket", "Holiday Basket"),
    ];
    const html = await render();
    const headings = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1]);
    expect(headings).toEqual(["Everyday gift baskets", "Birthday", "Sympathy", "More gift baskets", "Build your own basket", "Seasonal gift boxes"]);
    expect(html).not.toContain("79.95");
    expect(html.match(/Price to be confirmed/g)).toHaveLength(4);
    expect(html).not.toContain("Price on request");
    expect(html.match(/Available by inquiry/g)).toHaveLength(4);
    expect(html).toMatch(/price of a curated basket already includes/i);
  });

  it("only says baskets are by inquiry while some are, and leaves purchasable baskets to their own card", async () => {
    mocks.products = [basket("small-gift-basket", "Small Gift Basket"), basket("medium-gift-basket", "Medium Gift Basket")];
    expect(await render()).toContain("Curated baskets are available by inquiry for now.");

    mocks.products = [basket("small-gift-basket", "Small Gift Basket"), basket("medium-gift-basket", "Medium Gift Basket", { channel: "online" })];
    expect(await render()).toContain("Baskets marked “Available by inquiry” are ordered by asking us.");

    mocks.products = [
      basket("small-gift-basket", "Small Gift Basket", { channel: "online", priceApproved: true, stockState: "known", stockQuantity: 5 }),
    ];
    const html = await render();
    expect(html).not.toMatch(/available by inquiry|ordered by asking/i);
    expect(html).toContain("$79.95");
    expect(html).toContain('href="/contact?topic=gift_basket"');
  });

  it("shows an approved price as a normal price", async () => {
    mocks.products = [basket("small-gift-basket", "Small Gift Basket", { priceApproved: true })];
    expect(await render()).toContain("$79.95");
  });

  it("links to the builder, and to the contact form for baskets and seasonal gift boxes, with no purchase action", async () => {
    mocks.products = [basket("small-gift-basket", "Small Gift Basket")];
    const html = await render();
    for (const href of ["/build-a-basket", "/contact?topic=gift_basket", "/contact?topic=gift_box"]) expect(html).toContain(`href="${href}"`);
    expect(html).toContain("(774) 283-4676");
    expect(html).not.toMatch(/<button/i);
    expect(html).not.toMatch(/add to bag/i);
  });

  it("has an empty state that still offers the other routes", async () => {
    const html = await render();
    expect(html).toContain("Our gift baskets will be listed here soon.");
    expect(html).not.toContain("<ul");
    for (const href of ["/build-a-basket", "/contact?topic=gift_basket", "/contact?topic=gift_box"]) expect(html).toContain(`href="${href}"`);
  });
});

/**
 * Build a Basket's item picker: a product sold in options (dark or milk pretzels, window or classic
 * Princess box) is one card with an option chooser, never one look-alike card per option.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(frontend)/build-a-basket/actions", () => ({ checkBasket: vi.fn(), startReservation: vi.fn() }));

import { BasketBuilder } from "@/components/builder/BasketBuilder";
import type { Media, Product } from "@/payload-types";
import { builderCards, builderDisplay, type BuilderDisplay } from "@/src/lib/catalog/builder-cards";
import { toBuilderProducts } from "@/src/lib/catalog/product";
import { DEFAULT_GIFT_SETTINGS } from "@/src/lib/gifts";

const photo = (id: number, alt: string) =>
  ({ id, alt, url: `/api/media/file/${id}.png`, approvedForLaunch: true, updatedAt: "", createdAt: "" }) as Media;

function product(patch: Partial<Product>): Product {
  return {
    id: 1,
    title: "Item",
    slug: "item",
    category: { id: 1, name: "Chocolates", slug: "chocolates", updatedAt: "", createdAt: "" },
    channel: "online",
    priceCents: 795,
    priceApproved: true,
    stockState: "known",
    stockQuantity: 10,
    basketEligible: true,
    giftTypes: ["sweet"],
    maxPerGift: 1,
    nutFree: "unknown",
    vegan: "unknown",
    updatedAt: "",
    createdAt: "",
    ...patch,
  } as Product;
}

// The three products customers saw twice on the live builder (2026-11-22), as the live data has them.
const pretzels = product({
  id: 26,
  title: "Chocolate Pretzels",
  brand: "Phillips Chocolates",
  images: [{ image: photo(40, "Philips Dark Chocolate Pretzels") }],
  variants: [
    { key: "dark", label: "Dark chocolate", stockState: "known", stockQuantity: 5, image: photo(37, "Dark chocolate pretzels") },
    { key: "milk", label: "Milk chocolate", stockState: "known", stockQuantity: 5, image: photo(117, "Milk chocolate pretzels") },
  ],
});
const princess = product({
  id: 4,
  title: "Phillips Chocolate Princess Assortment Box",
  images: [{ image: photo(41, "Princess Assortment Box") }],
  variants: [
    { key: "window", label: "Window style", stockState: "known", stockQuantity: 5 },
    { key: "classic", label: "Classic style", stockState: "known", stockQuantity: 5 },
  ],
});
const turtles = product({
  id: 23,
  title: "Turtles Bars",
  images: [{ image: photo(42, "Dark Chocolate Almond Turtles Bar") }],
  variants: [
    { key: "dark", label: "Dark chocolate almond", stockState: "known", stockQuantity: 5 },
    { key: "milk", label: "Milk chocolate pecan", stockState: "known", stockQuantity: 5 },
  ],
});
const fudge = product({ id: 20, title: "Cape Cod Penuche Fudge (no nuts)", category: { id: 2, name: "Fudge", slug: "fudge", updatedAt: "", createdAt: "" } });
const docs = [pretzels, princess, turtles, fudge];

function render(display: BuilderDisplay[]) {
  return renderToStaticMarkup(
    createElement(BasketBuilder, {
      settings: DEFAULT_GIFT_SETTINGS,
      products: docs.flatMap(toBuilderProducts),
      display,
      budgetNotice: "",
      previewStock: false,
      phone: "(774) 283-4076",
      phoneHref: "tel:+17742834076",
    }),
  );
}

/** The picker's cards: each one has a product photo or a "Photo coming soon" box. */
const pickerCards = (html: string) => html.split('<li class="flex flex-col border').slice(1);

describe("Build a Basket item picker", () => {
  it("lists a product with options once, not once per option", () => {
    const html = render(docs.flatMap(builderDisplay));
    const cards = pickerCards(html);
    expect(cards).toHaveLength(4);
    for (const title of ["Chocolate Pretzels", "Phillips Chocolate Princess Assortment Box", "Turtles Bars"]) {
      expect(cards.filter((c) => c.includes(`>${title}</`))).toHaveLength(1);
    }
  });

  it("offers each option inside the product's card", () => {
    const html = render(docs.flatMap(builderDisplay));
    const card = pickerCards(html).find((c) => c.includes(">Chocolate Pretzels</"))!;
    expect(card).toContain("<select");
    expect(card).toContain(">Dark chocolate</option>");
    expect(card).toContain(">Milk chocolate</option>");
    // The chosen option's own photo, not the product's first photo.
    expect(card).toContain('alt="Dark chocolate pretzels"');
    // A product without options has no chooser.
    const plain = pickerCards(html).find((c) => c.includes("Penuche"))!;
    expect(plain).not.toContain("<select");
  });

  it("never lists the same product twice, even when the catalog repeats it", () => {
    const display = [...docs, pretzels, fudge].flatMap(builderDisplay);
    expect(builderCards(display).map((c) => c.productId)).toEqual(["26", "4", "23", "20"]);
    expect(pickerCards(render(display))).toHaveLength(4);
  });
});

describe("builderDisplay", () => {
  it("names the product and the option separately, keeping the full name for the basket summary", () => {
    expect(builderDisplay(pretzels).map(({ id, productId, productTitle, optionLabel, title, imageAlt }) => ({ id, productId, productTitle, optionLabel, title, imageAlt }))).toEqual([
      { id: "26:dark", productId: "26", productTitle: "Chocolate Pretzels", optionLabel: "Dark chocolate", title: "Chocolate Pretzels — Dark chocolate", imageAlt: "Dark chocolate pretzels" },
      { id: "26:milk", productId: "26", productTitle: "Chocolate Pretzels", optionLabel: "Milk chocolate", title: "Chocolate Pretzels — Milk chocolate", imageAlt: "Milk chocolate pretzels" },
    ]);
    expect(builderDisplay(turtles).map((d) => d.imageAlt)).toEqual(["Dark Chocolate Almond Turtles Bar", "Dark Chocolate Almond Turtles Bar"]);
  });
});

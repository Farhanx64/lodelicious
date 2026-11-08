/** The board's header (D31): lockup, nav in board order, the bow, and four labelled icons. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PhotoStrip } from "@/components/home/PhotoStrip";
import { SiteHeader } from "@/components/layout/SiteHeader";

const html = renderToStaticMarkup(createElement(SiteHeader, { staging: false, storeName: "Souset-Pink", tagline: "Sweets · Chocolates · Gifts" }));

describe("SiteHeader", () => {
  it("shows the lockup and the nav in the board's order", () => {
    expect(html).toContain("Souset-Pink");
    expect(html).toContain("Sweets · Chocolates · Gifts");
    const desktop = html.slice(html.indexOf('aria-label="Primary"'), html.indexOf("lg:hidden"));
    const labels = [...desktop.matchAll(/class="caps[^"]*"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(labels).toEqual(["Shop", "Sweets", "Chocolates", "Gifts", "Custom Baskets", "About"]);
  });

  it("gives every icon an accessible name and a real destination", () => {
    for (const [label, href] of [
      ["Search", "/shop#shop-search"],
      ["Account", "/account"],
      ["Wishlist", "/wishlist"],
      ["Shopping bag", "/cart"],
    ]) {
      expect(html).toMatch(new RegExp(`<a aria-label="${label}"[^>]*href="${href.replace("?", "\\?")}"`));
    }
  });

  it("shows how many items are in the bag, spoken as part of the bag link", () => {
    const withBag = renderToStaticMarkup(createElement(SiteHeader, { staging: false, storeName: "Souset-Pink", bagCount: 3 }));
    expect(withBag).toContain('aria-label="Shopping bag, 3 items"');
    expect(withBag).toMatch(/data-bag-count="true"[^>]*>3</);
    expect(html).not.toContain("data-bag-count");
  });

  it("hides the staging note in production", () => {
    expect(html).not.toContain("Staging preview");
  });
});

describe("Promo banner", () => {
  const slides = [
    { id: "a", text: "November fall deals — fall baskets are coming in", linkUrl: "/shop", linkLabel: "Shop fall" },
    { id: "b", text: "Thanksgiving baskets are in season", linkUrl: "/build-a-basket", linkLabel: null },
  ];

  it("replaces the staging note at the top with a labelled, pausable carousel", () => {
    const withPromo = renderToStaticMarkup(createElement(SiteHeader, { staging: true, storeName: "Souset-Pink", promo: { slides, seconds: 5 } }));
    expect(withPromo).not.toContain("Staging preview");
    expect(withPromo).toContain('aria-roledescription="carousel"');
    expect(withPromo).toContain('aria-label="Promotions"');
    expect(withPromo).toContain("November fall deals");
    expect(withPromo).toMatch(/href="\/shop"[^>]*>Shop fall</);
    expect(withPromo).toMatch(/href="\/build-a-basket"[^>]*>Shop now</);
    expect(withPromo).toContain('aria-label="Pause promotions"');
    expect(withPromo.indexOf("data-promo-banner")).toBeLessThan(withPromo.indexOf("<header"));
  });

  it("drops the arrows and pause button for a single slide", () => {
    const one = renderToStaticMarkup(createElement(SiteHeader, { staging: false, storeName: "Souset-Pink", promo: { slides: slides.slice(0, 1) } }));
    expect(one).toContain("data-promo-banner");
    expect(one).not.toContain("Next promotion");
  });

  it("falls back to the staging note when the promo is switched off or empty", () => {
    for (const promo of [null, { slides: [] }]) {
      const off = renderToStaticMarkup(createElement(SiteHeader, { staging: true, storeName: "Souset-Pink", promo }));
      expect(off).toContain("Staging preview");
      expect(off).not.toContain("data-promo-banner");
    }
  });
});

describe("PhotoStrip", () => {
  const placeholder = { id: 9, alt: "Gift box", approvedForLaunch: false, url: "/media/x.jpg", sizes: {} } as never;

  it("shows mood-board placeholders on staging but never on the live site (D32)", () => {
    const before = process.env.APP_ENV;
    try {
      process.env.APP_ENV = "staging";
      expect(renderToStaticMarkup(createElement(PhotoStrip, { images: [placeholder] }))).toContain('alt="Gift box"');
      process.env.APP_ENV = "production";
      const live = renderToStaticMarkup(createElement(PhotoStrip, { images: [placeholder] }));
      expect(live).not.toContain("Gift box");
      expect(live.match(/data-placeholder/g)).toHaveLength(5);
    } finally {
      process.env.APP_ENV = before;
    }
  });

  it("always shows five frames, with branded placeholders until photos are uploaded", () => {
    const strip = renderToStaticMarkup(createElement(PhotoStrip, { images: [] }));
    expect(strip.match(/<li/g)).toHaveLength(5);
    expect(strip.match(/data-placeholder/g)).toHaveLength(5);
  });
});

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

  it("hides the staging note in production", () => {
    expect(html).not.toContain("Staging preview");
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

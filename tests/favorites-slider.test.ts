/** The Shop Favorites slider's static markup (D33); behaviour is checked in the browser. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FavoritesSlider } from "@/components/home/FavoritesSlider";

describe("FavoritesSlider", () => {
  const html = renderToStaticMarkup(
    createElement(FavoritesSlider, { count: 2 }, createElement("li", { key: "a" }, "A"), createElement("li", { key: "b" }, "B")),
  );

  it("is a labelled carousel region around a plain list of cards", () => {
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).toContain('aria-label="Shop favorites"');
    expect(html).toMatch(/<ul[^>]*data-slider-track[^>]*><li>A<\/li><li>B<\/li><\/ul>/);
  });

  it("renders no controls until it knows the cards overflow (no dead buttons)", () => {
    expect(html).not.toContain("<button");
  });
});

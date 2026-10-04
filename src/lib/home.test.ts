import { describe, expect, it } from "vitest";

import { favoritesLayout, favoritesLimit } from "./home";

describe("Shop Favorites layouts (D33)", () => {
  it("shows exactly a full grid, or up to 12 in the slider", () => {
    expect(favoritesLimit("grid-2x2")).toBe(4);
    expect(favoritesLimit("grid-3x2")).toBe(6);
    expect(favoritesLimit("slider")).toBe(12);
  });

  it("falls back to the slider for anything unknown", () => {
    expect(favoritesLayout(undefined)).toBe("slider");
    expect(favoritesLayout("carousel")).toBe("slider");
    expect(favoritesLayout("grid-2x2")).toBe("grid-2x2");
  });
});

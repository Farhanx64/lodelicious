/** Shop Favorites layouts Lody can pick in /admin → Home page (D33). */
export const FAVORITES_LAYOUTS = [
  { value: "slider", label: "Slider (moves on its own, with pause)", limit: 12 },
  { value: "grid-2x2", label: "Grid — 2 × 2 (4 products)", limit: 4 },
  { value: "grid-3x2", label: "Grid — 3 across × 2 rows (6 products)", limit: 6 },
] as const;

export type FavoritesLayout = (typeof FAVORITES_LAYOUTS)[number]["value"];

/** Unknown or missing values fall back to the slider, the default. */
export function favoritesLayout(value: unknown): FavoritesLayout {
  return FAVORITES_LAYOUTS.some((l) => l.value === value) ? (value as FavoritesLayout) : "slider";
}

/** How many featured products each layout shows. */
export function favoritesLimit(layout: FavoritesLayout): number {
  return FAVORITES_LAYOUTS.find((l) => l.value === layout)!.limit;
}

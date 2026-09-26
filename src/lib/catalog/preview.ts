/**
 * Staging-only review aid: with PREVIEW_ASSUME_STOCK=true and APP_ENV not "production", products
 * whose stock hasn't been counted are treated as in stock so the builder can be tried out. It can
 * never apply in production, and the builder says clearly that it's a preview.
 */
export function previewStockEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.APP_ENV !== "production" && env.PREVIEW_ASSUME_STOCK === "true";
}

import { isPreviewEnv } from "../app-env";

/**
 * Staging-only review aid: with PREVIEW_ASSUME_STOCK=true and APP_ENV explicitly local, staging
 * or test, products whose stock hasn't been counted are treated as in stock so the builder can be
 * tried out. It can never apply anywhere else (an unset APP_ENV counts as production), and the
 * builder says clearly that it's a preview.
 */
export function previewStockEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return isPreviewEnv(env) && env.PREVIEW_ASSUME_STOCK === "true";
}

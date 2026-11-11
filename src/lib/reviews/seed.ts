/**
 * The starting Google reviews (D52) from data/google-reviews.json, copied by hand from the shop's
 * Google Maps listing. Loaded only into an empty Reviews collection, so re-running it never brings
 * back a review staff deleted and never touches anything else.
 */
import fs from "node:fs";
import path from "node:path";

import type { Payload } from "payload";

import { MAX_REVIEW_NAME_LENGTH, MAX_REVIEW_TEXT_LENGTH } from "./shared";

export type SeedReview = { name: string; rating: number; text: string };

/** Reads and checks the file; a malformed entry stops the seed rather than being skipped quietly. */
export function loadGoogleReviews(root = process.cwd()): SeedReview[] {
  const file = JSON.parse(fs.readFileSync(path.join(root, "data/google-reviews.json"), "utf8")) as { reviews?: unknown };
  if (!Array.isArray(file.reviews)) throw new Error("data/google-reviews.json has no reviews list");
  return file.reviews.map((raw, i) => {
    const r = raw as Partial<SeedReview>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const text = typeof r.text === "string" ? r.text.trim() : "";
    if (!name || name.length > MAX_REVIEW_NAME_LENGTH) throw new Error(`review ${i + 1}: bad name`);
    if (!text || text.length > MAX_REVIEW_TEXT_LENGTH) throw new Error(`review ${i + 1}: bad text`);
    if (!Number.isInteger(r.rating) || r.rating! < 1 || r.rating! > 5) throw new Error(`review ${i + 1}: bad rating`);
    return { name, rating: r.rating!, text };
  });
}

export type SeedReviewsReport = { created: number; skipped: "not-empty" | null };

export async function seedGoogleReviews(payload: Payload, reviews: SeedReview[]): Promise<SeedReviewsReport> {
  const existing = (await payload.count({ collection: "reviews", overrideAccess: true })).totalDocs;
  if (existing > 0) return { created: 0, skipped: "not-empty" };
  // The carousel shows the newest first, so create them last to first: the file's order is the carousel's.
  for (const r of [...reviews].reverse()) {
    await payload.create({ collection: "reviews", data: { name: r.name, rating: r.rating, text: r.text }, overrideAccess: true });
  }
  return { created: reviews.length, skipped: null };
}

/**
 * Shared by the Reviews collection, the home page and the carousel (D52). No imports, so client
 * components, collections and server code can all use it.
 */

export const MAX_REVIEW_NAME_LENGTH = 40;
export const MAX_REVIEW_TEXT_LENGTH = 1500;

/** The listing as of 2026-11-11 (data/google-reviews.json); staff update these in Store details → Google reviews. */
export const GOOGLE_RATING_DEFAULT = "5.0";
export const GOOGLE_REVIEW_COUNT_DEFAULT = 34;
export const GOOGLE_REVIEW_URL_DEFAULT = "https://www.google.com/maps?cid=6229617616978653533";

/** "5", "4.8" or "5.0": a rating Google could show. */
export function validateGoogleRating(value: string | null | undefined): true | string {
  const v = value?.trim();
  if (!v) return true;
  return /^[1-5](\.\d)?$/.test(v) && Number(v) <= 5 ? true : "A rating from 1.0 to 5.0, e.g. 4.8";
}

/** "5.0 ★ on Google · 34 reviews", or null when no rating is set. */
export function googleRatingLine(rating: string | null | undefined, count: number | null | undefined): string | null {
  const r = rating?.trim();
  if (!r) return null;
  const n = typeof count === "number" && count > 0 ? Math.round(count) : null;
  return `${r} ★ on Google${n ? ` · ${n} review${n === 1 ? "" : "s"}` : ""}`;
}

/** How many reviews the home page carousel cycles through. */
export const CAROUSEL_LIMIT = 12;

/** What the carousel needs, and nothing else. */
export type PublicReview = {
  id: string;
  name: string;
  /** 1 to 5. */
  rating: number;
  text: string;
  /** YYYY-MM-DD, or null. */
  date: string | null;
};

/** "October 2026" from YYYY-MM-DD (or an ISO timestamp); empty when unreadable. */
export function reviewMonth(date: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(date ?? "");
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return "";
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Only an https link may become the "Leave us a review on Google" button. */
export function googleReviewHref(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  try {
    return new URL(v).protocol === "https:" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Customer reviews of a product (D69). A customer sends one from the product page; it is saved as
 * "pending" and shows nowhere until staff approve it in /admin → Website → Product reviews.
 * Nothing here creates a review on anyone's behalf, and the Google reviews of the shop (D52) are a
 * separate collection that never feeds product ratings.
 *
 * Framework-free: takes the Payload instance, so tests drive the exact code the page runs.
 */
import type { Payload, Where } from "payload";

import { HONEYPOT_FIELD } from "../inquiries/shared";

export const REVIEW_LIMITS = { name: 40, minText: 10, text: 1500, email: 200 } as const;
export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export type ReviewFormValues = { name?: string; rating?: string; text?: string; email?: string };
export type ReviewFormState = { error: string | null; sent?: boolean; values?: ReviewFormValues };

export type ApprovedReview = { id: string; name: string; rating: number; text: string; date: string };
export type ReviewSummary = { count: number; average: number };

const clean = (value: unknown, max: number) =>
  (typeof value === "string" ? value : "")
    // Control characters out, except tab and newline.
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);

/** What goes back into the form after an error, so the customer doesn't retype it. */
export function echoReviewValues(raw: Record<string, unknown>): ReviewFormValues {
  return { name: clean(raw.name, REVIEW_LIMITS.name), rating: clean(raw.rating, 1), text: clean(raw.text, REVIEW_LIMITS.text), email: clean(raw.email, REVIEW_LIMITS.email) };
}

export type ParsedReview = { name: string; rating: number; text: string; email: string | null };

/** Checks every field again on the server; the browser is never trusted. */
export function parseReviewForm(raw: Record<string, unknown>): { ok: true; review: ParsedReview } | { ok: false; error: string } {
  const name = clean(raw.name, REVIEW_LIMITS.name + 1).replace(/\s+/g, " ");
  const text = clean(raw.text, REVIEW_LIMITS.text + 1).replace(/\n{3,}/g, "\n\n");
  const email = clean(raw.email, REVIEW_LIMITS.email + 1);
  const rating = Number(clean(raw.rating, 2));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "Please choose a star rating from 1 to 5." };
  if (!name) return { ok: false, error: "Please add your first name or initials." };
  if (name.length > REVIEW_LIMITS.name) return { ok: false, error: `Please keep your name under ${REVIEW_LIMITS.name} characters.` };
  if (text.length < REVIEW_LIMITS.minText) return { ok: false, error: "Please write a few words about the product." };
  if (text.length > REVIEW_LIMITS.text) return { ok: false, error: `Please keep your review under ${REVIEW_LIMITS.text} characters.` };
  if (/https?:\/\/|www\.|\[url/i.test(`${name} ${text}`)) return { ok: false, error: "Please leave links out of your review." };
  if (email && (email.length > REVIEW_LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { ok: false, error: "That email address doesn't look right. It's optional, so you can leave it empty." };
  return { ok: true, review: { name, rating, text, email: email || null } };
}

/**
 * Saves a pending review for `product` (already looked up by the caller as a product customers can
 * see). A filled honeypot is dropped silently, with the same thank-you a person would see.
 */
export async function submitProductReview(payload: Payload, product: { id: number } | null, raw: Record<string, unknown>): Promise<ReviewFormState> {
  if (clean(raw[HONEYPOT_FIELD], 200)) return { error: null, sent: true };
  if (!product) return { error: "We couldn't find that product. Please reload the page and try again.", values: echoReviewValues(raw) };
  const parsed = parseReviewForm(raw);
  if (!parsed.ok) return { error: parsed.error, values: echoReviewValues(raw) };
  try {
    await payload.create({ collection: "product-reviews", data: { product: product.id, ...parsed.review, status: "pending" }, overrideAccess: true });
  } catch (err) {
    payload.logger.error({ err, msg: "product review could not be saved" });
    return { error: "Sorry, we couldn't save your review. Please try again in a minute.", values: echoReviewValues(raw) };
  }
  return { error: null, sent: true };
}

const approvedFor = (productId: number): Where => ({ and: [{ product: { equals: productId } }, { status: { equals: "approved" } }] });

/** Approved reviews of one product, newest first, with the average and count over all approved ones. */
export async function approvedReviews(payload: Payload, productId: number, limit = 20): Promise<{ reviews: ApprovedReview[]; summary: ReviewSummary | null }> {
  // Staff-only over the API, so the storefront reads with override and states exactly what is public (as D42).
  const { docs } = await payload.find({
    collection: "product-reviews",
    where: approvedFor(productId),
    sort: "-createdAt",
    limit: 500,
    depth: 0,
    select: { name: true, rating: true, text: true, createdAt: true },
    overrideAccess: true,
  });
  const valid = docs.filter((d) => Number.isInteger(d.rating) && d.rating >= 1 && d.rating <= 5 && d.name?.trim() && d.text?.trim());
  if (!valid.length) return { reviews: [], summary: null };
  const average = Math.round((valid.reduce((sum, d) => sum + d.rating, 0) / valid.length) * 10) / 10;
  return {
    reviews: valid.slice(0, limit).map((d) => ({ id: String(d.id), name: d.name.trim(), rating: d.rating, text: d.text.trim(), date: String(d.createdAt).slice(0, 10) })),
    summary: { count: valid.length, average },
  };
}

/**
 * schema.org fields for the Product (Google's review snippet rules): only real, approved reviews
 * of this product, and nothing at all when there are none. Never put on the shop (the Store
 * entity): Google treats reviews a business shows of itself as self-serving.
 */
export function reviewJsonLd(summary: ReviewSummary | null, reviews: readonly ApprovedReview[]): Record<string, unknown> {
  if (!summary || summary.count === 0 || reviews.length === 0) return {};
  return {
    aggregateRating: { "@type": "AggregateRating", ratingValue: summary.average.toFixed(1), reviewCount: summary.count, bestRating: 5, worstRating: 1 },
    review: reviews.slice(0, 10).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.name },
      datePublished: r.date,
      reviewBody: r.text,
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
    })),
  };
}

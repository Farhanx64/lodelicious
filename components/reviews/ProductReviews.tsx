import { reviewMonth } from "@/src/lib/reviews/shared";
import type { ApprovedReview, ReviewSummary } from "@/src/lib/reviews/product-reviews";

import { ProductReviewForm } from "./ProductReviewForm";

type Action = Parameters<typeof ProductReviewForm>[0]["action"];

const stars = (n: number) => `${"★".repeat(n)}${"☆".repeat(5 - n)}`;

/** Approved customer reviews of a product, then the form (D69). Only approved reviews ever reach this component. */
export function ProductReviews({ reviews, summary, action, productSlug, productTitle }: { reviews: ApprovedReview[]; summary: ReviewSummary | null; action: Action; productSlug: string; productTitle: string }) {
  return (
    <section aria-labelledby="reviews" className="mb-12 max-w-[72ch]">
      <h2 id="reviews" className="mb-2 text-3xl">
        Customer reviews
      </h2>
      {summary ? (
        <p className="mb-6" data-review-summary>
          <span aria-hidden="true" className="text-gold-text">
            {stars(Math.round(summary.average))}
          </span>{" "}
          {summary.average.toFixed(1)} out of 5 · {summary.count} review{summary.count === 1 ? "" : "s"}
        </p>
      ) : (
        <p className="mb-6 text-ink-soft">No reviews yet.</p>
      )}
      {reviews.length > 0 && (
        <ul className="mb-8 space-y-5">
          {reviews.map((r) => (
            <li key={r.id} className="border-b border-line pb-4">
              <p className="mb-1">
                <span aria-hidden="true" className="text-gold-text">
                  {stars(r.rating)}
                </span>
                <span className="sr-only">
                  {r.rating} out of 5 stars
                </span>
              </p>
              <p className="mb-2 whitespace-pre-line">{r.text}</p>
              <p className="text-sm text-ink-soft">
                {r.name}
                {reviewMonth(r.date) ? ` · ${reviewMonth(r.date)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      <ProductReviewForm action={action} productSlug={productSlug} productTitle={productTitle} />
    </section>
  );
}

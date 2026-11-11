import { googleRatingLine, googleReviewHref, type PublicReview } from "@/src/lib/reviews/shared";

import { ReviewsCarousel } from "./ReviewsCarousel";

/**
 * Home page Google reviews (D52): the carousel of reviews Lody copied in under Website → Reviews,
 * the rating line typed into Store details → Google reviews (not fetched), and a "Leave us a review
 * on Google" button when the Google review link is set. Renders nothing when there are no reviews.
 */
type Props = { reviews: PublicReview[]; googleReviewUrl?: string | null; googleRating?: string | null; googleReviewCount?: number | null };

export function ReviewsSection({ reviews, googleReviewUrl, googleRating, googleReviewCount }: Props) {
  if (reviews.length === 0) return null;
  const href = googleReviewHref(googleReviewUrl);
  const rating = googleRatingLine(googleRating, googleReviewCount);
  return (
    <section aria-labelledby="reviews" className="mb-12 border-y border-gold bg-paper px-4 py-8 text-center sm:px-8">
      <h2 id="reviews" className={`text-2xl ${rating ? "mb-2" : "mb-6"}`}>
        What our customers say
      </h2>
      {rating && (
        <p className="caps mb-6 text-[0.72rem] text-gold-text" data-google-rating>
          {rating}
        </p>
      )}
      <ReviewsCarousel reviews={reviews} />
      {href && (
        <p className="mt-6">
          <a href={href} target="_blank" rel="noopener" className="caps inline-flex min-h-11 items-center border border-gold-text px-7 text-[0.75rem] text-gold-text no-underline" data-google-review-link>
            Leave us a review on Google<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      )}
    </section>
  );
}

/** Home page Google reviews (D52): hidden when empty, the Google button only with a link, carousel markup. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReviewsCarousel } from "@/components/home/ReviewsCarousel";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { toPublicReview } from "@/src/lib/reviews/service";
import { loadGoogleReviews } from "@/src/lib/reviews/seed";
import { googleRatingLine, googleReviewHref, reviewMonth, validateGoogleRating, type PublicReview } from "@/src/lib/reviews/shared";

const REVIEWS: PublicReview[] = [
  { id: "1", name: "Maria", rating: 5, text: "Best fudge on the South Shore!", date: "2026-10-02" },
  { id: "2", name: "J. P.", rating: 4, text: "Lovely baskets, wrapped beautifully.", date: null },
  { id: "3", name: "Tom", rating: 5, text: "The chocolate fountain made the party.", date: "2026-08-20" },
];
const LINK = "https://g.page/r/CExample123/review";

const section = (reviews: PublicReview[], googleReviewUrl?: string | null, googleRating: string | null = "5.0", googleReviewCount: number | null = 34) =>
  renderToStaticMarkup(createElement(ReviewsSection, { reviews, googleReviewUrl, googleRating, googleReviewCount }));

describe("ReviewsSection", () => {
  it("renders nothing when there are no reviews, even with a Google link", () => {
    expect(section([])).toBe("");
    expect(section([], LINK)).toBe("");
  });

  it("shows the carousel and the Google button when the link is set", () => {
    const html = section(REVIEWS, LINK);
    expect(html).toContain("What our customers say");
    expect(html).toContain("Best fudge on the South Shore!");
    expect(html).toContain(`href="${LINK}"`);
    expect(html).toContain("Leave us a review on Google");
  });

  it("shows the typed-in Google rating, and hides it when empty", () => {
    expect(section(REVIEWS)).toContain("5.0 ★ on Google · 34 reviews");
    expect(section(REVIEWS, null, "4.8", null)).toContain("4.8 ★ on Google<");
    expect(section(REVIEWS, null, "  ", 34)).not.toContain("data-google-rating");
  });

  it("hides the Google button when the link is unset, blank or not https", () => {
    for (const link of [undefined, null, "", "   ", "http://g.page/r/x/review", "javascript:alert(1)"]) {
      const html = section(REVIEWS, link);
      expect(html).toContain("Best fudge");
      expect(html).not.toContain("data-google-review-link");
      expect(html).not.toContain("Leave us a review on Google");
    }
  });
});

describe("ReviewsCarousel markup", () => {
  const html = renderToStaticMarkup(createElement(ReviewsCarousel, { reviews: REVIEWS }));

  it("is a labelled carousel with a live region, one slide per review and prev/pause/next buttons", () => {
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).toContain('aria-label="Google reviews"');
    expect(html).toMatch(/aria-live="(off|polite)"/);
    expect(html.match(/aria-roledescription="slide"/g)).toHaveLength(3);
    for (const name of ["Previous review", "Pause the reviews", "Next review"]) expect(html).toContain(`aria-label="${name}"`);
  });

  it("shows stars, the name, the month and a Google review label", () => {
    expect(html).toContain('aria-label="5 out of 5 stars"');
    expect(html).toContain('aria-label="4 out of 5 stars"');
    expect(html).toContain("Maria");
    expect(html).toContain("October 2026");
    expect(html.match(/Google review</g)).toHaveLength(3);
  });

  it("starts on the first review and hides the others from view and screen readers", () => {
    expect(html.match(/aria-hidden="false"/g)).toHaveLength(1);
    expect(html.match(/aria-hidden="true"[^>]*class="[^"]*invisible/g)).toHaveLength(2);
  });

  it("has no buttons for a single review", () => {
    expect(renderToStaticMarkup(createElement(ReviewsCarousel, { reviews: REVIEWS.slice(0, 1) }))).not.toContain("<button");
  });
});

describe("helpers", () => {
  it("formats and checks the Google rating", () => {
    expect(googleRatingLine("5.0", 1)).toBe("5.0 ★ on Google · 1 review");
    expect(googleRatingLine(null, 34)).toBeNull();
    for (const ok of ["", "5", "5.0", "4.8", "1.0"]) expect(validateGoogleRating(ok)).toBe(true);
    for (const bad of ["5.5", "6", "0.9", "4,8", "five"]) expect(validateGoogleRating(bad)).not.toBe(true);
  });

  it("ships seven well-formed starting reviews with short names", () => {
    const reviews = loadGoogleReviews();
    expect(reviews).toHaveLength(7);
    for (const r of reviews) expect(r.name).toMatch(/^\S+( \S\.)?$/);
  });

  it("formats the month and ignores bad dates", () => {
    expect(reviewMonth("2026-10-02")).toBe("October 2026");
    expect(reviewMonth("2026-03-01T05:00:00.000Z")).toBe("March 2026");
    expect(reviewMonth(null)).toBe("");
    expect(reviewMonth("2026-13-01")).toBe("");
  });

  it("accepts only https review links", () => {
    expect(googleReviewHref(` ${LINK} `)).toBe(LINK);
    expect(googleReviewHref("ftp://x")).toBeNull();
    expect(googleReviewHref("not a url")).toBeNull();
  });

  it("maps a stored review to what the page needs", () => {
    expect(toPublicReview({ id: 7, name: " Ana ", rating: 4.6, text: " Great! ", date: "2026-09-01T12:00:00.000Z" })).toEqual({
      id: "7",
      name: "Ana",
      rating: 5,
      text: "Great!",
      date: "2026-09-01",
    });
  });
});

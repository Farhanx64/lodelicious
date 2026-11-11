"use client";

import { useEffect, useState } from "react";

import { reviewMonth, type PublicReview } from "@/src/lib/reviews/shared";

const INTERVAL_MS = 6000;

/**
 * One Google review at a time (D52). Moves on every 6 s, but holds still while hovered, while
 * anything inside has keyboard focus, while the tab is hidden, once it is touched, after the Pause
 * button or an arrow is used, and always for people who ask for reduced motion (WCAG 2.2.2). The live region is
 * polite whenever the carousel is not turning by itself, so screen readers are not interrupted
 * every 6 s (WAI-ARIA carousel pattern). Left and Right arrow keys step through the reviews.
 */
export function ReviewsCarousel({ reviews }: { reviews: PublicReview[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [held, setHeld] = useState(false); // hover or focus inside
  const [reducedMotion, setReducedMotion] = useState(false);
  const count = reviews.length;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const autoplay = count > 1 && playing && !held && !reducedMotion;
  useEffect(() => {
    if (!autoplay) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setIndex((i) => (i + 1) % count);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [autoplay, count]);

  const go = (direction: 1 | -1) => {
    setPlaying(false);
    setIndex((i) => (i + direction + count) % count);
  };

  const control = "inline-flex size-11 items-center justify-center border border-gold-text bg-paper text-gold-text hover:bg-coastal-deep hover:text-paper";

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Google reviews"
      className="mx-auto max-w-[44rem]"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      // A tap means someone is reading: stop until they press Play.
      onTouchStart={() => setPlaying(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
      onKeyDown={(e) => {
        if (count < 2) return;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          go(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(-1);
        }
      }}
    >
      {/* Every review sits in the same grid cell, so the box is as tall as the longest one and nothing jumps. */}
      <div className="grid" aria-live={autoplay ? "off" : "polite"} aria-atomic="false" data-reviews-track>
        {reviews.map((r, i) => {
          const active = i === index;
          const month = reviewMonth(r.date);
          return (
            <figure
              key={r.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={!active}
              className={`[grid-area:1/1] transition-opacity duration-500 motion-reduce:transition-none ${active ? "opacity-100" : "invisible opacity-0"}`}
            >
              <p className="mb-3 text-xl tracking-[0.2em] text-gold" role="img" aria-label={`${r.rating} out of 5 stars`}>
                {"★".repeat(r.rating)}
                <span className="text-line">{"★".repeat(5 - r.rating)}</span>
              </p>
              <blockquote className="font-display text-[1.35rem] leading-snug text-ink italic sm:text-2xl">
                <p className="whitespace-pre-line">“{r.text}”</p>
              </blockquote>
              <figcaption className="mt-4 text-ink-soft">
                <span className="font-semibold text-ink">{r.name}</span>
                {month && <> · {month}</>}
                <span className="caps ml-2 inline-block border border-line px-1.5 py-0.5 align-middle text-[0.65rem] text-ink-soft">Google review</span>
              </figcaption>
            </figure>
          );
        })}
      </div>

      {count > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button type="button" className={control} aria-label="Previous review" onClick={() => go(-1)}>
            <span aria-hidden="true">‹</span>
          </button>
          {/* Under reduced motion it never moves by itself, so there is nothing to pause. */}
          {!reducedMotion && (
            <button
              type="button"
              className={control}
              aria-label={playing ? "Pause the reviews" : "Play the reviews"}
              aria-pressed={!playing}
              onClick={() => setPlaying((p) => !p)}
            >
              <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
            </button>
          )}
          <button type="button" className={control} aria-label="Next review" onClick={() => go(1)}>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      )}
    </div>
  );
}

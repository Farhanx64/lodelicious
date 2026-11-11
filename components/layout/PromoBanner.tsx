"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type PromoSlide = {
  id?: string | null;
  text: string;
  linkUrl?: string | null;
  linkLabel?: string | null;
};

/**
 * The promo ribbon above the header, edited under Website → Store details → Promo banner.
 * One full-width slide at a time on a scroll-snap track, so swipe and trackpad work natively.
 * It advances every few seconds and loops; like the Favorites slider (D33) it has a Pause/Play
 * button (WCAG 2.2.2) and holds still while hovered, focused, hidden, or for reduced motion.
 */
export function PromoBanner({ slides, seconds = 5 }: { slides: PromoSlide[]; seconds?: number | null }) {
  const track = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [held, setHeld] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const many = slides.length > 1;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // Track which slide is showing after a swipe as well as after the arrows and autoplay.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => setCurrent(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
  }, []);

  const go = useCallback(
    (index: number) => {
      const el = track.current;
      if (!el) return;
      const next = (index + slides.length) % slides.length;
      el.scrollTo({
        left: next * el.clientWidth,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [slides.length, reducedMotion],
  );

  const autoplay = many && playing && !held && !reducedMotion;
  const interval = Math.min(Math.max(seconds ?? 5, 3), 20) * 1000;
  useEffect(() => {
    if (!autoplay) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") go(current + 1);
    }, interval);
    return () => window.clearInterval(id);
  }, [autoplay, current, go, interval]);

  if (slides.length === 0) return null;

  const control = "inline-flex size-11 shrink-0 items-center justify-center text-paper/90 hover:text-paper";
  const icon = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    "aria-hidden": true,
    className: "size-5",
  };

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Promotions"
      data-promo-banner
      className="bg-coastal-deep text-paper"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
    >
      <div className="mx-auto flex w-[min(100%-1rem,72rem)] items-center">
        {many && (
          <button type="button" className={control} aria-label="Previous promotion" onClick={() => go(current - 1)}>
            <svg {...icon}>
              <path d="m14.5 6-6 6 6 6" />
            </svg>
          </button>
        )}
        <ul
          ref={track}
          data-promo-track
          aria-live={autoplay ? "off" : "polite"}
          className="flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide, i) => (
            <li
              key={slide.id ?? i}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${slides.length}`}
              inert={many && i !== current ? true : undefined}
              className="flex w-full shrink-0 snap-center flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-2 py-2 text-center text-[0.92rem] leading-snug"
            >
              <span className="font-semibold">{slide.text}</span>
              {slide.linkUrl && (
                <Link href={slide.linkUrl} className="caps inline-flex min-h-8 items-center text-[0.75rem] text-paper underline underline-offset-4 hover:no-underline">
                  {slide.linkLabel || "Shop now"}
                </Link>
              )}
            </li>
          ))}
        </ul>
        {many && (
          <>
            <button type="button" className={control} aria-label="Next promotion" onClick={() => go(current + 1)}>
              <svg {...icon}>
                <path d="m9.5 6 6 6-6 6" />
              </svg>
            </button>
            <button type="button" className={control} aria-label={playing ? "Pause promotions" : "Play promotions"} onClick={() => setPlaying((p) => !p)}>
              {playing ? (
                <svg {...icon}>
                  <path d="M9 6v12M15 6v12" />
                </svg>
              ) : (
                <svg {...icon}>
                  <path d="M8 5.5v13l10-6.5-10-6.5Z" />
                </svg>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const INTERVAL_MS = 5000;

/**
 * Shop Favorites slider (D33). Cards scroll sideways with snap points; swipe and trackpad work
 * natively. It advances one card every 5 s, but WCAG 2.2.2 requires a way to stop it, so it has a
 * Pause/Play button and also holds still while hovered, while anything inside has keyboard focus,
 * while the tab is hidden, and always for people who ask for reduced motion.
 */
export function FavoritesSlider({ children, count }: { children?: React.ReactNode; count: number }) {
  const track = useRef<HTMLUListElement>(null);
  const [playing, setPlaying] = useState(true);
  const [held, setHeld] = useState(false); // hover or focus inside
  const [reducedMotion, setReducedMotion] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => setOverflowing(el.scrollWidth > el.clientWidth + 2);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [count]);

  const step = useCallback((direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector("li");
    const width = card ? card.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || "0") : el.clientWidth;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    const atStart = el.scrollLeft <= 4;
    // Loop around at either end so the slider never just stops.
    if (direction === 1 && atEnd) el.scrollTo({ left: 0, behavior: "smooth" });
    else if (direction === -1 && atStart) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    else el.scrollBy({ left: direction * width, behavior: "smooth" });
  }, []);

  const autoplay = playing && !held && !reducedMotion && overflowing;
  useEffect(() => {
    if (!autoplay) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") step(1);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [autoplay, step]);

  const control =
    "inline-flex size-11 items-center justify-center border border-gold-text bg-paper text-gold-text hover:bg-gold-text hover:text-paper";

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Shop favorites"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
    >
      {overflowing && (
        <div className="mb-3 flex justify-end gap-2">
          <button
            type="button"
            className={control}
            aria-label={playing ? "Pause the slider" : "Play the slider"}
            aria-pressed={!playing}
            data-slider-toggle
            onClick={() => setPlaying((p) => !p)}
          >
            <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
          </button>
          <button
            type="button"
            className={control}
            aria-label="Previous products"
            onClick={() => {
              setPlaying(false);
              step(-1);
            }}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            className={control}
            aria-label="Next products"
            onClick={() => {
              setPlaying(false);
              step(1);
            }}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      )}
      <ul
        ref={track}
        data-slider-track
        // Each card takes 4 per row on desktop, 2 on tablets and ~1.3 on phones.
        className="grid snap-x snap-mandatory auto-cols-[76%] grid-flow-col gap-5 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:thin] sm:auto-cols-[calc((100%-1.25rem)/2)] lg:auto-cols-[calc((100%-3.75rem)/4)] [&>li]:snap-start"
      >
        {children}
      </ul>
    </div>
  );
}

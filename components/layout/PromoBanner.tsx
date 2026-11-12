"use client";

import Link from "next/link";
import { useState } from "react";

export type PromoSlide = {
  id?: string | null;
  text: string;
  linkUrl?: string | null;
  linkLabel?: string | null;
};

/**
 * The promo ribbon above the header, edited under Website → Store details → Promo banner.
 * A thin one-line ticker (D57): the promotions scroll past in a continuous loop. The list is
 * rendered twice and the track moves by half its width, so the loop has no seam. It holds still
 * while hovered or focused, and a tap on the strip toggles pause; there are no buttons (owner's choice). Under reduced motion it keeps
 * moving, slowly, as the owner asked (see the marquee note in D49). "Seconds" sets the speed:
 * roughly how long each promotion takes to pass.
 */
export function PromoBanner({ slides, seconds = 5 }: { slides: PromoSlide[]; seconds?: number | null }) {
  const [paused, setPaused] = useState(false);
  if (slides.length === 0) return null;

  const perSlide = Math.min(Math.max(seconds ?? 5, 3), 20);
  // At least a few copies across the strip so one short promo still fills a wide screen.
  const copies = Math.max(2, Math.ceil(4 / slides.length));
  const run = Array.from({ length: copies }, () => slides).flat();
  const duration = `${run.length * perSlide * 1.6}s`;

  const items = (hidden: boolean) =>
    run.map((slide, i) => (
      <li key={`${hidden ? "b" : "a"}-${slide.id ?? "s"}-${i}`} className="flex shrink-0 items-center gap-3 px-6" aria-hidden={hidden || i >= slides.length ? true : undefined}>
        <span className="font-semibold">{slide.text}</span>
        {slide.linkUrl && (
          <Link
            href={slide.linkUrl}
            tabIndex={hidden || i >= slides.length ? -1 : undefined}
            className="caps text-[0.7rem] text-paper underline underline-offset-4 hover:no-underline"
          >
            {slide.linkLabel || "Shop now"}
          </Link>
        )}
        <span aria-hidden className="pl-6 text-paper/60">
          ✦
        </span>
      </li>
    ));

  return (
    <div
      role="region"
      aria-label="Promotions"
      data-promo-banner
      data-paused={paused ? "" : undefined}
      className="promo-ticker relative overflow-hidden bg-coastal-deep text-paper"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a")) setPaused((p) => !p);
      }}
    >
      <div className="promo-ticker-track flex w-max py-1.5 text-[0.85rem] leading-tight whitespace-nowrap" style={{ animationDuration: duration }}>
        <ul className="flex shrink-0">{items(false)}</ul>
        <ul className="flex shrink-0" aria-hidden>
          {items(true)}
        </ul>
      </div>
    </div>
  );
}

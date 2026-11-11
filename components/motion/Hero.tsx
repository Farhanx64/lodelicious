"use client";

import { motion, useReducedMotion } from "motion/react";

import { EASE_SOFT } from "./Reveal";

/**
 * The home hero's title: each line rises from below its own clipped box, one after the other.
 * The padding and negative margin give descenders room inside the clip at a 0.92 line height.
 */
export function HeroTitle({ id, lines }: { id: string; lines: React.ReactNode[] }) {
  return (
    <h1 id={id} className="display-1">
      {lines.map((line, i) => (
        <span key={i} className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
          <motion.span
            className="js-reveal block"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.9, ease: EASE_SOFT, delay: i * 0.12 }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

// Two outlines of the same pebble, with matching commands so one can ease into the other.
const PEBBLE_A = "M300 60C420 50 540 130 550 270C560 400 480 530 330 545C200 558 70 480 55 330C40 200 110 90 220 65C250 58 275 62 300 60Z";
const PEBBLE_B = "M312 48C446 62 556 172 538 302C520 438 438 552 300 548C172 544 52 448 62 300C70 182 132 82 240 56C266 50 290 46 312 48Z";

/**
 * The hero picture: it fades and settles in over a large soft pebble in the card colour, whose
 * outline drifts slowly between two shapes. The pebble is decoration and holds still for reduced motion.
 */
export function HeroMedia({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const still = useReducedMotion();
  return (
    <div className={`relative ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 600 600" preserveAspectRatio="none" className="absolute -inset-[7%] size-[114%] text-clay">
        <motion.path
          d={PEBBLE_A}
          fill="currentColor"
          animate={still ? undefined : { d: [PEBBLE_A, PEBBLE_B] }}
          transition={{ duration: 12, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
        />
      </svg>
      <motion.div
        className="js-reveal relative size-full"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: EASE_SOFT, delay: 0.3 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

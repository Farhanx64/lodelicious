"use client";

import { motion } from "motion/react";

export const EASE_SOFT = [0.22, 1, 0.36, 1] as const;

type Props = {
  /** Position in its row; each step waits another 0.08 s. */
  index?: number;
  className?: string;
  children: React.ReactNode;
};

const reveal = (index: number) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.7, ease: EASE_SOFT, delay: index * 0.08 },
});

/**
 * Fades its content up 24 px the first time it scrolls into view. `js-reveal` is what shows it
 * without JavaScript or with reduced motion (see app/globals.css).
 */
export function RevealItem({ index = 0, className = "", children }: Props) {
  return (
    <motion.li className={`js-reveal ${className}`} {...reveal(index)}>
      {children}
    </motion.li>
  );
}

export function Reveal({ index = 0, className = "", children }: Props) {
  return (
    <motion.div className={`js-reveal ${className}`} {...reveal(index)}>
      {children}
    </motion.div>
  );
}

"use client";

import { MotionConfig } from "motion/react";

/** Site-wide motion settings: movement is skipped for people who ask for reduced motion. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

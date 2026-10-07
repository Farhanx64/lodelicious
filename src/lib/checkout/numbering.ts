/**
 * Order and reservation numbers (A02). The next number is one above the highest ever used, never
 * a count: counting rows reuses a number as soon as the owner deletes an early order, and every
 * later checkout then collides with an existing one until it gives up.
 */

/** Digits after the prefix, e.g. 1005 for `SP-1005`; null if the text isn't such a number. */
export function suffixOf(number: string, prefix: "SP" | "SPR"): number | null {
  const m = new RegExp(`^${prefix}-(\\d+)$`).exec(number);
  return m ? Number(m[1]) : null;
}

/** The sequence for the next record, given the highest suffix in use (null when there are none). `bump` skips ahead after a collision. */
export function nextSequence(highestSuffix: number | null, bump = 0): number {
  const base = highestSuffix !== null && Number.isFinite(highestSuffix) ? Math.max(highestSuffix, 1000) : 1000;
  return base - 1000 + 1 + bump;
}

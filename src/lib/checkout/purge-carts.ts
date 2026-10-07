/**
 * Delete abandoned shopping bags (D41, audit A15). Every add-to-bag from a browser without the bag
 * cookie creates a `carts` row, and nothing else removes them, so a script (or just a year of
 * visitors) grows the table without limit. A bag nobody has touched for 30 days is gone for good:
 * the cookie that points at it expires after 30 days anyway (session.ts).
 *
 * Meant for cron (`npx payload run scripts/purge-carts.ts`). Takes the cutoff as a parameter so
 * tests do not need to backdate rows.
 */
import type { Payload } from "payload";

export const CART_MAX_AGE_DAYS = 30;

export function cartCutoff(now: Date, days = CART_MAX_AGE_DAYS): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** Deletes bags last changed before `cutoff`. Returns how many were deleted. */
export async function purgeStaleCarts(payload: Payload, cutoff: Date): Promise<number> {
  const { docs } = await payload.delete({
    collection: "carts",
    where: { updatedAt: { less_than: cutoff.toISOString() } },
    overrideAccess: true,
  });
  return docs.length;
}

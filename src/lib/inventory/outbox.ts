/**
 * Retry timing for the Clover outbox (INV 06). The sync worker is built later against these
 * rules: a transient failure retries with a growing, capped delay, and after the last attempt the
 * event is `dead` and needs a person. The paid order is never affected by any of it. Pure.
 */

export const OUTBOX_MAX_ATTEMPTS = 8;
const BASE_MS = 30_000;
const CAP_MS = 6 * 3600_000;

/** Delay before attempt number `failedAttempts + 1`: 30 s, 1 min, 2 min, 4 min … capped at 6 hours. */
export function backoffMs(failedAttempts: number): number {
  const n = Math.max(1, Math.trunc(failedAttempts));
  return Math.min(CAP_MS, BASE_MS * 2 ** (n - 1));
}

export type FailureOutcome = { status: "failed"; nextAttemptAt: string } | { status: "dead"; nextAttemptAt: null };

/** The state to record after an attempt failed, given how many attempts have now failed. */
export function afterFailure(failedAttempts: number, now: Date, maxAttempts = OUTBOX_MAX_ATTEMPTS): FailureOutcome {
  if (failedAttempts >= maxAttempts) return { status: "dead", nextAttemptAt: null };
  return { status: "failed", nextAttemptAt: new Date(now.getTime() + backoffMs(failedAttempts)).toISOString() };
}

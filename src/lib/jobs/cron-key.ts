/**
 * The key the Worker's `scheduled` handler presents to `/ops/cron/<job>` (D51).
 *
 * It is an HMAC of the job name under PAYLOAD_SECRET, so there is no extra secret to manage and a
 * key for one job does not run another. `cloudflare-worker.mjs` computes the same value with Web
 * Crypto (it cannot import this file); keep the two in step.
 */
import crypto from "node:crypto";

export const CRON_KEY_HEADER = "x-cron-key";

export function cronKey(job: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`cron:${job}`).digest("hex");
}

/** Constant-time check. False when the secret is missing, so an unconfigured app runs nothing. */
export function isValidCronKey(job: string, presented: string | null, secret: string | undefined): boolean {
  if (!secret || !presented) return false;
  const expected = Buffer.from(cronKey(job, secret));
  const given = Buffer.from(presented);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

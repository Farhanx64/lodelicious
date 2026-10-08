/**
 * Submission nonces (A11, D42). Every checkout and reserve form is rendered with a signed,
 * single-purpose nonce in a hidden field. The idempotency key includes it, so a true double submit
 * of one rendered form maps to one record, while the same items, details and slot submitted from a
 * fresh form later make a new order. The signature stops a browser from inventing nonces for
 * other purposes; it carries no secret and no customer data.
 */
import crypto from "node:crypto";

export type SubmissionKind = "order" | "reservation";

function mac(kind: SubmissionKind, random: string): string {
  const secret = process.env.PAYLOAD_SECRET;
  if (!secret) throw new Error("PAYLOAD_SECRET is required");
  return crypto.createHmac("sha256", secret).update(`submission:${kind}:${random}`).digest("base64url");
}

/** A fresh nonce for one rendered form. */
export function newSubmission(kind: SubmissionKind): string {
  const random = crypto.randomBytes(16).toString("base64url");
  return `${random}.${mac(kind, random)}`;
}

/** The nonce if it was issued by this server for `kind`, otherwise null. */
export function verifySubmission(kind: SubmissionKind, value: unknown): string | null {
  if (typeof value !== "string" || value.length > 120) return null;
  const [random, given] = value.split(".");
  if (!random || !given || !/^[\w-]+$/.test(random)) return null;
  const expected = Buffer.from(mac(kind, random));
  const actual = Buffer.from(given);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual) ? value : null;
}

export const EXPIRED_FORM = "This page has expired. Please reload it and try again — your bag is saved.";

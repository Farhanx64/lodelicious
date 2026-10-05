/**
 * Order and reservation records (D35, D36): non-guessable access tokens for guest pages, and
 * the plain-text assembly instructions staff pack from.
 */
import crypto from "node:crypto";

import type { Cents } from "../money";

export function newAccessToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Constant-time check of a URL token against the stored hash. */
export function tokenMatches(token: string | undefined | null, storedHash: string | null | undefined): boolean {
  if (!token || !storedHash) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Stable key for "this exact submission": a retried or double-clicked submit maps to one record. */
export function idempotencyKey(...parts: unknown[]): string {
  return crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function formatNumber(prefix: "SP" | "SPR", sequence: number): string {
  return `${prefix}-${1000 + sequence}`;
}

export type BasketComponent = { productId: string; name: string; quantity: number; unitPriceCents: Cents };

export function assemblyInstructions(input: {
  title: string;
  basketSizeIn?: string | null;
  components: BasketComponent[];
  message?: string | null;
  requests?: string | null;
}): string {
  const lines = [
    `${input.title}${input.basketSizeIn ? ` — ${input.basketSizeIn}" basket` : ""}`,
    ...input.components.map((c) => `• ${c.quantity} × ${c.name}`),
  ];
  if (input.message?.trim()) lines.push("", `Gift message: "${input.message.trim()}"`);
  if (input.requests?.trim()) lines.push("", `Customer requests (confirm before packing): ${input.requests.trim()}`);
  return lines.join("\n");
}

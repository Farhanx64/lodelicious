/**
 * Identities that tie stock to orders, reservations and checkouts (D40). Pure.
 */
import crypto from "node:crypto";

import type { PlanLine } from "./types";

/**
 * Unique for one order or reservation for all time. A number alone is not enough: the highest
 * number can be reused after the owner deletes that order (A02), and an old ledger row must never
 * stop a new order's stock from moving.
 */
export function recordKeyOf(record: { number: string; createdAt: string }): string {
  return `${record.number}.${Date.parse(record.createdAt)}`;
}

const digest = (...parts: unknown[]): string => crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 40);

/** The hold owner for a bag: its token hash, so a bag has at most one checkout in progress. */
export function bagOwner(cartTokenHash: string): string {
  return `bag:${cartTokenHash.slice(0, 40)}`;
}

/** The hold owner for a basket checkout: the same customer and basket and pickup always map to it. */
export function basketOwner(draft: unknown, email: string, slot: unknown): string {
  return `basket:${digest(draft, email.trim().toLowerCase(), slot)}`;
}

/** A readable snapshot of what a record takes from stock, stored on it so a retry uses the same plan. */
export function serializePlan(plan: readonly PlanLine[]): { productId: string; variantKey: string | null; quantity: number }[] {
  return plan.map((l) => ({ productId: l.productId, variantKey: l.variantKey, quantity: l.quantity }));
}

export function parsePlan(value: unknown): PlanLine[] {
  if (!Array.isArray(value)) return [];
  const out: PlanLine[] = [];
  for (const item of value) {
    const i = item as { productId?: unknown; variantKey?: unknown; quantity?: unknown };
    if (typeof i?.quantity !== "number" || !Number.isSafeInteger(i.quantity) || i.quantity <= 0 || i.productId === undefined || i.productId === null) continue;
    out.push({ productId: String(i.productId), variantKey: typeof i.variantKey === "string" && i.variantKey ? i.variantKey : null, quantity: i.quantity });
  }
  return out;
}

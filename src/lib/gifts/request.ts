/**
 * Parse an untrusted custom-basket request from the browser. Returns null for anything malformed;
 * rule checks (counts, stock, budget…) are validateGift's job, not this function's.
 */
import { GIFT_TYPES, SIZE_CODES, type GiftType, type SizeCode, type GiftRequest } from "./types";

const MAX_SELECTIONS = 100;
const MAX_BUDGET_CENTS = 10_000_000;

export function parseCustomRequest(input: unknown): Extract<GiftRequest, { kind: "custom" }> | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  if (r.kind !== "custom") return null;
  if (!SIZE_CODES.includes(r.size as SizeCode) || !GIFT_TYPES.includes(r.giftType as GiftType)) return null;

  const budget = r.budgetCents ?? null;
  if (budget !== null && (typeof budget !== "number" || !Number.isSafeInteger(budget) || budget < 0 || budget > MAX_BUDGET_CENTS)) {
    return null;
  }
  if (!Array.isArray(r.selections) || r.selections.length > MAX_SELECTIONS) return null;

  const selections = r.selections.map((s) => {
    const row = (s ?? {}) as Record<string, unknown>;
    return { productId: String(row.productId ?? "").slice(0, 64), quantity: Number(row.quantity) };
  });
  return { kind: "custom", size: r.size as SizeCode, giftType: r.giftType as GiftType, budgetCents: budget, selections };
}

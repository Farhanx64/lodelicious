/**
 * Parse an untrusted custom-basket request from the browser. Returns null for anything malformed;
 * rule checks (counts, stock, budget…) are validateGift's job, not this function's.
 *
 * Every selection must be a whole number of at least 1, and a product listed twice is merged into
 * one line (A01). Negative, fractional or duplicated quantities used to pass validation as one
 * thing and be priced and packed as another. Both the builder actions and the signed basket cookie
 * come through here, so the order and reservation code only ever sees clean lines.
 */
import { GIFT_TYPES, SIZE_CODES, type GiftType, type SizeCode, type GiftRequest } from "./types";

const MAX_SELECTIONS = 100;
const MAX_BUDGET_CENTS = 10_000_000;
/** No real basket holds anywhere near this many of one item; it only stops absurd integers. */
export const MAX_SELECTION_QUANTITY = 99;

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

  const merged = new Map<string, number>();
  for (const s of r.selections) {
    const row = (s ?? {}) as Record<string, unknown>;
    const productId = String(row.productId ?? "").slice(0, 64);
    const quantity = Number(row.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_SELECTION_QUANTITY) return null;
    const total = (merged.get(productId) ?? 0) + quantity;
    if (total > MAX_SELECTION_QUANTITY) return null;
    merged.set(productId, total);
  }
  const selections = [...merged].map(([productId, quantity]) => ({ productId, quantity }));
  return { kind: "custom", size: r.size as SizeCode, giftType: r.giftType as GiftType, budgetCents: budget, selections };
}

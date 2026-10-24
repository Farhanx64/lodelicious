/**
 * Putting stock back after a cancellation (D40). Refunds and restocking are separate decisions:
 * cancelling never restocks, and a restock is an explicit, audited staff action limited to what the
 * record actually took from stock. Pure.
 */
import { mergePlan, unitKey } from "./units";
import type { PlanLine } from "./types";

export type RestockCheck = { ok: true; lines: PlanLine[] } | { ok: false; error: string };

/**
 * `sold` and `restocked` map a unit to the total taken from, and already put back into, stock by
 * one record. A restock may not exceed what is left to put back.
 */
export function checkRestock(requested: readonly PlanLine[], sold: ReadonlyMap<string, number>, restocked: ReadonlyMap<string, number>, label: (line: PlanLine) => string): RestockCheck {
  const lines = mergePlan(requested);
  if (lines.length === 0) return { ok: false, error: "Add at least one component to put back, with a quantity of 1 or more." };
  for (const line of lines) {
    const key = unitKey(line);
    const left = (sold.get(key) ?? 0) - (restocked.get(key) ?? 0);
    if ((sold.get(key) ?? 0) <= 0) return { ok: false, error: `${label(line)} was not taken from stock by this record, so it can't be put back.` };
    if (line.quantity > left) return { ok: false, error: left <= 0 ? `${label(line)} has already been put back.` : `Only ${left} of ${label(line)} can still be put back.` };
  }
  return { ok: true, lines };
}

export type PerishableCheck = { ok: true } | { ok: false; error: string };

/** Perishable goods return to sellable stock only when an owner or manager says they are still fit to sell. */
export function checkPerishables(perishableNames: readonly string[], canConfirm: boolean, confirmed: boolean): PerishableCheck {
  if (perishableNames.length === 0) return { ok: true };
  const names = perishableNames.join(", ");
  if (!canConfirm) return { ok: false, error: `${names} is perishable. Only the owner or a manager can put perishable items back in stock.` };
  if (!confirmed) return { ok: false, error: `${names} is perishable. Tick the confirmation that it is unopened and still fit to sell.` };
  return { ok: true };
}

/**
 * Turns a paid order or reservation into stock movements, and reconciles records whose payment
 * result arrived late (INV 04, INV 06, D40). The paid record is never lost and the customer is
 * never charged again: if the stock can't be taken, the record is flagged for staff instead.
 */
import type { Payload } from "payload";

import type { Order, Reservation } from "@/payload-types";

import { commitSale, releaseHolds, type ShortUnit } from "./ledger";
import { parsePlan, recordKeyOf } from "./records";
import type { StockStatus } from "./types";

type Collection = "orders" | "reservations";
type StockRecord = Order | Reservation;

const STAFF_REVIEW_FIELD = { orders: "fulfillmentStatus", reservations: "reservationStatus" } as const;

async function titleOf(payload: Payload, short: ShortUnit): Promise<string> {
  const product = await payload.findByID({ collection: "products", id: short.unit.productId, depth: 0, overrideAccess: true }).catch(() => null);
  const name = product?.title ?? `product ${short.unit.productId}`;
  return short.unit.variantKey ? `${name} (${short.unit.variantKey})` : name;
}

async function setStatus(payload: Payload, collection: Collection, id: number, status: StockStatus, extra: { [k: string]: unknown } = {}) {
  await payload.update({ collection, id, data: { stockStatus: status, ...extra } as never, overrideAccess: true });
}

export type SettleResult = "committed" | "needs_attention" | "nothing_to_do";

/**
 * Take a paid record's stock off the shelf, once. Safe to call again for the same record: movements
 * already written are skipped. Call it right after a successful charge, and again for any record
 * found paid but still `held` (a crash, or a payment event that arrived after the hold expired).
 */
export async function settleStock(payload: Payload, collection: Collection, record: StockRecord, now: Date): Promise<SettleResult> {
  const plan = parsePlan(record.stockPlan);
  if (plan.length === 0) return "nothing_to_do";
  if (record.stockStatus === "committed" || record.stockStatus === "resolved" || record.stockStatus === "needs_attention") return "nothing_to_do";

  const reference = record.number;
  let note: string | null = null;

  // Staff cancelled it while the customer was still paying. Taking stock for a cancelled record would
  // sell the goods twice, so keep the paid record, take nothing and say so.
  const status = (record as unknown as { [k: string]: unknown })[STAFF_REVIEW_FIELD[collection]];
  if (status === "canceled") {
    note = "Paid after the record was cancelled. Nothing was taken from stock. Refund the customer or reinstate the record, then mark this resolved.";
    console.error(`[inventory] ${reference} was paid after it was cancelled: ${note}`);
    await setStatus(payload, collection, record.id, "needs_attention", { stockNote: note });
    return "needs_attention";
  }

  try {
    const result = await commitSale(payload, {
      owner: record.stockOwner ?? null,
      plan,
      reason: collection === "orders" ? "sale" : "reservation",
      reference,
      recordKey: recordKeyOf(record),
      now,
    });
    if (result.ok) {
      await setStatus(payload, collection, record.id, "committed");
      return "committed";
    }
    const names = await Promise.all(result.short.map((s) => titleOf(payload, s)));
    note = `Paid, but stock could not be taken for: ${names.join(", ") || "unknown components"}. Nothing was taken from stock for this record.`;
  } catch (e) {
    note = `Paid, but the stock update failed (${(e as Error).message}). Nothing was taken from stock for this record.`;
  }

  console.error(`[inventory] ${reference} is paid but its stock needs attention: ${note}`);
  await setStatus(payload, collection, record.id, "needs_attention", {
    stockNote: note,
    [STAFF_REVIEW_FIELD[collection]]: "staff_review",
  });
  return "needs_attention";
}

/** Payment did not complete: let go of the hold and say so on the record. */
export async function releaseStock(payload: Payload, collection: Collection, record: StockRecord, now: Date): Promise<void> {
  if (record.stockOwner) await releaseHolds(payload, record.stockOwner, now);
  if (record.stockStatus === "held") await setStatus(payload, collection, record.id, "released");
}

const PAID = { orders: ["paid"], reservations: ["deposit_paid", "paid_in_full"] } as const;

/**
 * Records that were paid but never had their stock taken: the process stopped between the charge
 * and the stock update (`held`), or a payment event arrived after the checkout had already been
 * released as failed or expired (`released`). Run from the cron.
 */
export async function reconcilePaidHeld(payload: Payload, now: Date): Promise<{ checked: number; committed: number; needsAttention: number }> {
  const tally = { checked: 0, committed: 0, needsAttention: 0 };
  for (const collection of ["orders", "reservations"] as const) {
    const { docs } = await payload.find({
      collection,
      where: { and: [{ stockStatus: { in: ["held", "released"] } }, { paymentStatus: { in: [...PAID[collection]] } }] },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    });
    for (const record of docs as StockRecord[]) {
      tally.checked++;
      const result = await settleStock(payload, collection, record, now);
      if (result === "committed") tally.committed++;
      if (result === "needs_attention") tally.needsAttention++;
    }
  }
  return tally;
}

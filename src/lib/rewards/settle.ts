/**
 * What a record's payment means for its member's points (D45). Called after every save of an order or
 * reservation (checkout's own updates and staff edits alike), and safe to call any number of times:
 * each entry's key says what caused it, so it is posted once.
 *
 * - Paid (an order) or paid in full (a reservation): the points worked out at checkout are earned.
 * - Refunded: earned points are taken back (the balance may go below zero if they were spent).
 * - Failed or refunded: points spent on this order's current payment attempt are returned. Each
 *   attempt redeems under its own key, so a retry after a decline spends again and a later failure
 *   returns only what that attempt spent. Points are returned only if they were actually taken.
 * - Unknown: nothing moves until staff decide.
 *
 * The amounts come from the record, frozen at checkout, never from today's settings.
 */
import type { Payload } from "payload";

import { entryKey, postEntry, postedPoints } from "./ledger";

type RewardsGroup = { member?: unknown; redeemedPoints?: number | null; earnPoints?: number | null } | null | undefined;

type SettleRecord = {
  id: number | string;
  idempotencyKey?: string | null;
  number?: string | null;
  paymentStatus?: string | null;
  paymentAttempts?: number | null;
  rewards?: RewardsGroup;
};

const idOf = (v: unknown): number | null => {
  const n = Number(v !== null && typeof v === "object" ? (v as { id: unknown }).id : v);
  return v === null || v === undefined || !Number.isSafeInteger(n) ? null : n;
};

const positive = (v: unknown): number => (typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : 0);

const EARNED_WHEN = { orders: ["paid"], reservations: ["paid_in_full"] } as const;

export async function settleRecordRewards(payload: Payload, collection: "orders" | "reservations", doc: SettleRecord, now: Date = new Date()): Promise<void> {
  const memberId = idOf(doc.rewards?.member);
  const recordId = idOf(doc.id);
  if (memberId === null || recordId === null) return;
  const status = String(doc.paymentStatus ?? "");
  const link = collection === "orders" ? { orderId: recordId } : { reservationId: recordId };
  const base = { memberId, reference: doc.number ?? null, ...link };

  const earn = positive(doc.rewards?.earnPoints);
  if (earn && (EARNED_WHEN[collection] as readonly string[]).includes(status)) {
    await postEntry(payload, { ...base, kind: "earn", points: earn, key: entryKey.earn(collection, doc) }, now);
  }
  if (status === "refunded") {
    const earned = await postedPoints(payload, entryKey.earn(collection, doc));
    if (earned && earned > 0) {
      await postEntry(payload, { ...base, kind: "reverse", points: -earned, key: entryKey.reverse(collection, doc), allowNegative: true, note: "Purchase refunded" }, now);
    }
  }

  if (collection !== "orders" || (status !== "failed" && status !== "refunded")) return;
  const attempt = Math.max(1, Number(doc.paymentAttempts ?? 1));
  const spent = await postedPoints(payload, entryKey.redeem(doc, attempt));
  if (spent && spent < 0) {
    await postEntry(
      payload,
      { ...base, kind: "restore", points: -spent, key: entryKey.restore(doc, attempt), note: status === "refunded" ? "Order refunded" : "Payment didn't complete" },
      now,
    );
  }
}

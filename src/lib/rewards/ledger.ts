/**
 * The points ledger (D45). Every change to a member's balance goes through `postEntry`: one atomic
 * batch (see ../inventory/db.ts) changes the balance on the member row and writes the ledger row
 * with the balance after it. The balance is never written any other way.
 *
 * - Each entry has a unique key that names what caused it ("earn:orders:12"), so a retry, a second
 *   save or a second process posts it once.
 * - A spend (redeem, or a negative staff adjustment) can't take the balance below zero; the batch
 *   rolls back instead. Taking back points already earned (a refund) can, because the customer may
 *   have spent them; the balance then shows what they owe back.
 */
import type { Payload } from "payload";

import { ABORT_IF_NOTHING_CHANGED, AlreadyApplied, GuardFailed, iso, query, runBatch } from "../inventory/db";

export const ENTRY_KINDS = ["welcome", "earn", "redeem", "restore", "reverse", "adjust"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const ENTRY_LABELS: Record<EntryKind, string> = {
  welcome: "Welcome points",
  earn: "Earned on a purchase",
  redeem: "Used for a reward",
  restore: "Returned (payment didn't complete, or refunded)",
  reverse: "Taken back (purchase refunded)",
  adjust: "Adjusted by the shop",
};

export type EntryInput = {
  memberId: number;
  kind: EntryKind;
  /** Signed, never 0: positive adds points, negative takes them. */
  points: number;
  key: string;
  orderId?: number | null;
  reservationId?: number | null;
  /** Our record number (SP-1001) or a short staff reference. */
  reference?: string | null;
  userId?: number | null;
  note?: string | null;
  /** Let the balance go below zero (taking back refunded earnings). */
  allowNegative?: boolean;
};

export type PostResult = { applied: true; balance: number } | { applied: false };

export class NotEnoughPoints extends Error {
  constructor() {
    super("Not enough points");
    this.name = "NotEnoughPoints";
  }
}

/**
 * What a key names. Never a bare row id: SQLite hands a deleted row's id to the next new row, so a
 * key built from it would match the deleted record's entry and the new one would never be posted.
 * Records use their own unique idempotency key; a member uses its id with the moment it joined.
 */
type RecordRef = { id: number | string; idempotencyKey?: string | null };
const ref = (r: RecordRef) => r.idempotencyKey || `id-${r.id}`;

export const entryKey = {
  welcome: (member: { id: number | string; createdAt: string }) => `welcome:${member.id}:${member.createdAt}`,
  earn: (collection: "orders" | "reservations", r: RecordRef) => `earn:${collection}:${ref(r)}`,
  reverse: (collection: "orders" | "reservations", r: RecordRef) => `reverse:${collection}:${ref(r)}`,
  redeem: (r: RecordRef, attempt: number) => `redeem:orders:${ref(r)}:${attempt}`,
  restore: (r: RecordRef, attempt: number) => `restore:orders:${ref(r)}:${attempt}`,
  adjust: (requestId: string) => `adjust:${requestId}`,
};

/** Posts one entry. Returns `applied: false` when its key was already posted; throws NotEnoughPoints when a spend would overdraw. */
export async function postEntry(payload: Payload, input: EntryInput, now: Date = new Date()): Promise<PostResult> {
  if (!Number.isSafeInteger(input.points) || input.points === 0) throw new RangeError(`Points must be a whole number other than 0: ${input.points}`);
  if (!Number.isSafeInteger(input.memberId)) throw new RangeError(`Not a member id: ${input.memberId}`);
  const args = {
    mid: input.memberId,
    delta: input.points,
    neg: input.allowNegative ? 1 : 0,
    kind: input.kind,
    oid: input.orderId ?? null,
    rid: input.reservationId ?? null,
    ref: input.reference ?? null,
    uid: input.userId ?? null,
    note: input.note ?? null,
    key: input.key,
    now: iso(now),
  };
  try {
    await runBatch(payload, [
      {
        sql: `UPDATE members SET points_balance = COALESCE(points_balance, 0) + :delta, updated_at = :now
              WHERE id = :mid AND (:neg = 1 OR :delta > 0 OR COALESCE(points_balance, 0) + :delta >= 0)`,
        args,
      },
      ABORT_IF_NOTHING_CHANGED,
      {
        sql: `INSERT INTO reward_entries (member_id, kind, points, balance_after, order_id, reservation_id, reference, user_id, note, idempotency_key, updated_at, created_at)
              VALUES (:mid, :kind, :delta, (SELECT points_balance FROM members WHERE id = :mid), :oid, :rid, :ref, :uid, :note, :key, :now, :now)`,
        args,
      },
    ]);
  } catch (e) {
    if (e instanceof AlreadyApplied) return { applied: false };
    if (e instanceof GuardFailed) throw new NotEnoughPoints();
    throw e;
  }
  return { applied: true, balance: await balanceOf(payload, input.memberId) };
}

export async function balanceOf(payload: Payload, memberId: number): Promise<number> {
  const [row] = await query(payload, "SELECT COALESCE(points_balance, 0) AS balance FROM members WHERE id = :mid", { mid: memberId });
  return row ? Number(row.balance) : 0;
}

/** The points posted under a key, or null when nothing was posted. */
export async function postedPoints(payload: Payload, key: string): Promise<number | null> {
  const [row] = await query(payload, "SELECT points FROM reward_entries WHERE idempotency_key = :key", { key });
  return row ? Number(row.points) : null;
}

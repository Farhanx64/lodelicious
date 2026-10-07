/**
 * The stock ledger, holds and outbox (INV 01, INV 04, INV 06, AC 04, D40). Server only: every
 * change to a counted quantity goes through here, in one atomic batch (see ./db.ts), together with
 * its movement row and its outbox event.
 *
 * Rules the statements enforce, whatever the callers do:
 * - Online sales never take sellable stock (counted − in-store reserve − other customers' active
 *   holds) below zero, and never use stock that is unknown or older than the allowed age.
 * - A hold makes its owner's units safe from other customers until it expires.
 * - Every movement has a unique key, so a component of a record moves once, however often the
 *   code retries or the same record is submitted twice.
 */
import type { Payload } from "payload";

import { ABORT_IF_NOTHING_CHANGED, AlreadyApplied, GuardFailed, iso, query, runBatch, type Stmt } from "./db";
import { enqueuesOutbox, type MovementReason, type PlanLine, type UnitRef } from "./types";
import { unitKey } from "./units";

// ------------------------------------------------------------------ SQL pieces

type Source = {
  from: string;
  state: string;
  qty: string;
  counted: string;
  /** `UPDATE` of this unit's stock row; `set` is the SET clause. */
  update: (set: string) => string;
  args: Record<string, unknown>;
};

/** Where one unit's counted stock lives: the product row, or one row of its options. */
function source(unit: UnitRef): Source {
  const pid = Number(unit.productId);
  if (!Number.isSafeInteger(pid)) throw new Error(`Not a product id: ${unit.productId}`);
  if (unit.variantKey === null) {
    return {
      from: "products p",
      state: "p.stock_state",
      qty: "p.stock_quantity",
      counted: "p.stock_counted_at",
      update: (set) => `UPDATE products SET ${set} WHERE id = :pid`,
      args: { pid, vkey: "" },
    };
  }
  return {
    from: "products p JOIN products_variants v ON v._parent_id = p.id AND v.key = :vk",
    state: "v.stock_state",
    qty: "v.stock_quantity",
    counted: "v.stock_counted_at",
    update: (set) => `UPDATE products_variants SET ${set} WHERE _parent_id = :pid AND key = :vk`,
    args: { pid, vk: unit.variantKey, vkey: unit.variantKey },
  };
}

const KNOWN = (s: Source) => `${s.state} = 'known' AND ${s.qty} IS NOT NULL`;
const FRESH = (s: Source) => `(:staleBefore IS NULL OR ${s.counted} >= :staleBefore)`;
const HOLDS = (exceptOwner: boolean) =>
  `(SELECT COALESCE(SUM(h.quantity), 0) FROM stock_holds h WHERE h.product_id = :pid AND h.variant_key = :vkey AND h.status = 'active' AND h.expires_at > :now${exceptOwner ? " AND h.owner <> :owner" : ""})`;

const staleBefore = (now: Date, maxAgeMs: number | null): string | null => (maxAgeMs === null ? null : iso(new Date(now.getTime() - maxAgeMs)));

const movementColumns =
  "product_id, product_title, variant_key, delta, reason, quantity_after, reference, user_id, note, idempotency_key, updated_at, created_at";

function outboxInsert(ikey: string, now: Date, reason: MovementReason): Stmt[] {
  if (!enqueuesOutbox(reason)) return [];
  return [
    {
      sql: `INSERT INTO outbox (event_type, payload, status, attempts, next_attempt_at, idempotency_key, updated_at, created_at)
            SELECT 'stock_changed',
                   json_object('productId', m.product_id, 'cloverId', p.clover_id, 'variantKey', NULLIF(m.variant_key, ''),
                               'delta', m.delta, 'quantityAfter', m.quantity_after, 'movementId', m.id, 'reason', m.reason, 'reference', m.reference),
                   'pending', 0, :now, :okey, :now, :now
            FROM stock_movements m LEFT JOIN products p ON p.id = m.product_id
            WHERE m.idempotency_key = :ikey AND m.delta <> 0`,
      args: { now: iso(now), okey: `stock_changed:${ikey}`, ikey },
    },
  ];
}

// ------------------------------------------------------------------ availability (for messages and the storefront)

export type UnitState = { known: boolean; fresh: boolean; quantity: number | null; reserve: number; holds: number };

/** Current counted stock of a unit with its reserve and other customers' active holds. */
export async function readUnit(payload: Payload, unit: UnitRef, opts: { now: Date; maxAgeMs: number | null; exceptOwner?: string | null }): Promise<UnitState | null> {
  const s = source(unit);
  const args: Record<string, unknown> = { ...s.args, now: iso(opts.now), staleBefore: staleBefore(opts.now, opts.maxAgeMs), owner: opts.exceptOwner ?? "" };
  const rows = await query(
    payload,
    `SELECT ${s.state} AS state, ${s.qty} AS qty, ${s.counted} AS counted, COALESCE(p.online_reserve, 0) AS reserve, ${HOLDS(Boolean(opts.exceptOwner))} AS holds,
            ${FRESH(s)} AS fresh FROM ${s.from} WHERE p.id = :pid`,
    args,
  );
  const row = rows[0];
  if (!row) return null;
  return {
    known: row.state === "known" && row.qty !== null && row.qty !== undefined,
    fresh: Number(row.fresh) === 1,
    quantity: row.qty === null || row.qty === undefined ? null : Number(row.qty),
    reserve: Number(row.reserve),
    holds: Number(row.holds),
  };
}

/** Units the online shop can still sell right now (0 when unknown, stale or gone). */
export async function sellableNow(payload: Payload, unit: UnitRef, opts: { now: Date; maxAgeMs: number | null; exceptOwner?: string | null }): Promise<number> {
  const state = await readUnit(payload, unit, opts);
  if (!state || !state.known || !state.fresh || state.quantity === null) return 0;
  return Math.max(0, state.quantity - state.reserve - state.holds);
}

// ------------------------------------------------------------------ holds

export type HoldInput = {
  /** Who holds it: the bag's token hash, or the basket checkout. Replaces everything this owner held before. */
  owner: string;
  reference?: string | null;
  plan: readonly PlanLine[];
  now: Date;
  ttlMs: number;
  maxAgeMs: number | null;
};

export type ShortUnit = { unit: UnitRef; available: number };
export type HoldResult = { ok: true } | { ok: false; short: ShortUnit[] };

export const holdKey = (owner: string, unit: UnitRef): string => `${owner}|${unit.productId}|${unit.variantKey ?? ""}`;

/**
 * Hold every unit of `plan` for `owner`, or none (INV 04, AC 04). The owner's earlier holds are
 * released first, inside the same batch, so a retry never competes with itself.
 */
export async function holdStock(payload: Payload, input: HoldInput): Promise<HoldResult> {
  const plan = input.plan.filter((l) => l.quantity > 0);
  if (plan.length === 0) {
    await releaseHolds(payload, input.owner, input.now); // nothing to hold now, so nothing stays held from before
    return { ok: true };
  }
  const now = iso(input.now);
  const expires = iso(new Date(input.now.getTime() + input.ttlMs));
  const stmts: Stmt[] = [
    { sql: "UPDATE stock_holds SET status = 'released', updated_at = :now WHERE owner = :owner AND status = 'active'", args: { now, owner: input.owner } },
  ];
  for (const line of plan) {
    const s = source(line);
    stmts.push(
      {
        sql: `INSERT INTO stock_holds (key, product_id, variant_key, quantity, owner, reference, status, expires_at, updated_at, created_at)
              SELECT :hkey, p.id, :vkey, :qty, :owner, :ref, 'active', :expires, :now, :now
              FROM ${s.from}
              WHERE p.id = :pid AND ${KNOWN(s)} AND ${FRESH(s)}
                AND ${s.qty} - COALESCE(p.online_reserve, 0) - ${HOLDS(false)} >= :qty
              ON CONFLICT(key) DO UPDATE SET quantity = excluded.quantity, status = 'active', expires_at = excluded.expires_at,
                reference = excluded.reference, owner = excluded.owner, updated_at = excluded.updated_at`,
        args: {
          ...s.args,
          hkey: holdKey(input.owner, line),
          qty: line.quantity,
          owner: input.owner,
          ref: input.reference ?? null,
          expires,
          now,
          staleBefore: staleBefore(input.now, input.maxAgeMs),
        },
      },
      ABORT_IF_NOTHING_CHANGED,
    );
  }
  try {
    await runBatch(payload, stmts);
    return { ok: true };
  } catch (e) {
    if (!(e instanceof GuardFailed)) throw e;
  }
  const short: ShortUnit[] = [];
  for (const line of plan) {
    const available = await sellableNow(payload, line, { now: input.now, maxAgeMs: input.maxAgeMs, exceptOwner: input.owner });
    if (available < line.quantity) short.push({ unit: { productId: line.productId, variantKey: line.variantKey }, available });
  }
  return { ok: false, short };
}

/** Let go of everything an owner holds that is still active (payment failed, or the order was cancelled). */
export async function releaseHolds(payload: Payload, owner: string, now: Date): Promise<number> {
  const [result] = await runBatch(payload, [
    { sql: "UPDATE stock_holds SET status = 'released', updated_at = :now WHERE owner = :owner AND status = 'active'", args: { now: iso(now), owner } },
  ]);
  return result.rowsAffected;
}

/** Mark overdue holds expired, and forget finished holds after `keepMs`. Returns what it did. */
export async function expireHolds(payload: Payload, now: Date, keepMs = 7 * 24 * 3600_000): Promise<{ expired: number; pruned: number }> {
  const [expired, pruned] = await runBatch(payload, [
    { sql: "UPDATE stock_holds SET status = 'expired', updated_at = :now WHERE status = 'active' AND expires_at <= :now", args: { now: iso(now) } },
    { sql: "DELETE FROM stock_holds WHERE status <> 'active' AND updated_at < :cutoff", args: { cutoff: iso(new Date(now.getTime() - keepMs)) } },
  ]);
  return { expired: expired.rowsAffected, pruned: pruned.rowsAffected };
}

// ------------------------------------------------------------------ sales

export type CommitInput = {
  /** The holder whose holds are turned into this sale. Null when nothing was held. */
  owner: string | null;
  plan: readonly PlanLine[];
  reason: Extract<MovementReason, "sale" | "reservation">;
  /** Order or reservation number shown on each movement. */
  reference: string;
  /** Unique for this record for all time (number plus creation time), so a reused number can't collide. */
  recordKey: string;
  now: Date;
  note?: string | null;
};

export type CommitResult = { ok: true; applied: boolean } | { ok: false; short: ShortUnit[] };

export const movementKey = (prefix: string, recordKey: string, unit: UnitRef): string => `${prefix}:${recordKey}:${unitKey(unit)}`;

async function existingKeys(payload: Payload, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const args = Object.fromEntries(keys.map((k, i) => [`k${i}`, k]));
  const rows = await query(payload, `SELECT idempotency_key AS k FROM stock_movements WHERE idempotency_key IN (${keys.map((_, i) => `:k${i}`).join(", ")})`, args);
  return new Set(rows.map((r) => String(r.k)));
}

/**
 * Take a paid sale off the shelf: for each component, decrement stock, write the movement and the
 * outbox event and turn the hold into the sale, all or nothing. Components already recorded for
 * this record are skipped (the second submit of the same order moves nothing).
 *
 * Without a live hold (it expired before a late "paid" event arrived) the stock is taken only if
 * it is still sellable; otherwise the result is `short` and the caller must keep the paid order
 * and flag it for staff.
 */
export async function commitSale(payload: Payload, input: CommitInput): Promise<CommitResult> {
  const lines = input.plan.filter((l) => l.quantity > 0);
  const keyOf = (l: PlanLine) => movementKey(input.reason, input.recordKey, l);
  const done = await existingKeys(payload, lines.map(keyOf));
  const todo = lines.filter((l) => !done.has(keyOf(l)));
  if (todo.length === 0) return { ok: true, applied: false };

  const now = iso(input.now);
  const stmts: Stmt[] = [];
  for (const line of todo) {
    const s = source(line);
    const ikey = keyOf(line);
    const args = {
      ...s.args,
      qty: line.quantity,
      now,
      reason: input.reason,
      ref: input.reference,
      note: input.note ?? null,
      ikey,
      owner: input.owner ?? "",
      hkey: input.owner ? holdKey(input.owner, line) : "",
      staleBefore: null,
    };
    stmts.push(
      {
        sql: `INSERT INTO stock_movements (${movementColumns})
              SELECT p.id, p.title, :vkey, -:qty, :reason, ${s.qty} - :qty, :ref, NULL, :note, :ikey, :now, :now
              FROM ${s.from}
              WHERE p.id = :pid AND ${KNOWN(s)} AND ${s.qty} >= :qty
                AND (
                  EXISTS (SELECT 1 FROM stock_holds mine WHERE mine.key = :hkey AND mine.status = 'active' AND mine.expires_at > :now AND mine.quantity >= :qty)
                  OR ${s.qty} - :qty >= COALESCE(p.online_reserve, 0) + ${HOLDS(Boolean(input.owner))}
                )`,
        args,
      },
      ABORT_IF_NOTHING_CHANGED,
      { sql: s.update("stock_quantity = stock_quantity - :qty"), args: { ...s.args, qty: line.quantity } },
      { sql: "UPDATE stock_holds SET status = 'converted', reference = :ref, updated_at = :now WHERE key = :hkey AND status = 'active'", args: { hkey: args.hkey, ref: input.reference, now } },
      ...outboxInsert(ikey, input.now, input.reason),
    );
  }

  try {
    await runBatch(payload, stmts);
    return { ok: true, applied: true };
  } catch (e) {
    if (!(e instanceof GuardFailed) && !(e instanceof AlreadyApplied)) throw e;
    // Another submit of the same record may have finished first.
    const after = await existingKeys(payload, todo.map(keyOf));
    if (todo.every((l) => after.has(keyOf(l)))) return { ok: true, applied: false };
    if (e instanceof AlreadyApplied) throw e;
  }
  const short: ShortUnit[] = [];
  for (const line of todo) {
    const state = await readUnit(payload, line, { now: input.now, maxAgeMs: null, exceptOwner: input.owner });
    const available = state?.known && state.quantity !== null ? Math.max(0, state.quantity - state.reserve - state.holds) : 0;
    if (!state || !state.known || (state.quantity ?? 0) < line.quantity || available < line.quantity) short.push({ unit: { productId: line.productId, variantKey: line.variantKey }, available });
  }
  return { ok: false, short };
}

// ------------------------------------------------------------------ staff and sync changes

export type MovementInput = {
  unit: UnitRef;
  /** `delta` adds or removes units from the known count; `count` sets the count to what was counted. */
  mode: "delta" | "count";
  /** The signed change, or the counted quantity. */
  amount: number;
  reason: Extract<MovementReason, "cancel_restock" | "count_correction" | "manual_adjustment" | "sync">;
  idempotencyKey: string;
  reference?: string | null;
  userId?: number | null;
  note?: string | null;
  /** When the shelf was counted (freshness); defaults to now. Only used by `count`. */
  countedAt?: Date;
};

export type AppliedMovement = { productId: string; variantKey: string | null; delta: number; quantityAfter: number };

/**
 * Apply staff adjustments, restocks, counts or sync reads, all or nothing. A change that would
 * take the count below zero, or change a quantity that was never counted, is refused with
 * GuardFailed and nothing moves.
 */
export async function applyMovements(payload: Payload, inputs: readonly MovementInput[], now: Date): Promise<AppliedMovement[]> {
  const stamp = iso(now);
  const stmts: Stmt[] = [];
  for (const m of inputs) {
    if (!Number.isSafeInteger(m.amount) || (m.mode === "count" && m.amount < 0)) throw new Error("Stock quantities are whole numbers");
    const s = source(m.unit);
    const base = {
      ...s.args,
      amount: m.amount,
      reason: m.reason,
      ref: m.reference ?? null,
      user: m.userId ?? null,
      note: m.note ?? null,
      ikey: m.idempotencyKey,
      now: stamp,
      countedAt: iso(m.countedAt ?? now),
    };
    if (m.mode === "delta") {
      stmts.push(
        {
          sql: `INSERT INTO stock_movements (${movementColumns})
                SELECT p.id, p.title, :vkey, :amount, :reason, ${s.qty} + :amount, :ref, :user, :note, :ikey, :now, :now
                FROM ${s.from} WHERE p.id = :pid AND ${KNOWN(s)} AND ${s.qty} + :amount >= 0`,
          args: base,
        },
        ABORT_IF_NOTHING_CHANGED,
        { sql: s.update("stock_quantity = stock_quantity + :amount"), args: { ...s.args, amount: m.amount } },
      );
    } else {
      stmts.push(
        {
          sql: `INSERT INTO stock_movements (${movementColumns})
                SELECT p.id, p.title, :vkey, :amount - COALESCE(${s.qty}, 0), :reason, :amount, :ref, :user, :note, :ikey, :now, :now
                FROM ${s.from} WHERE p.id = :pid`,
          args: base,
        },
        ABORT_IF_NOTHING_CHANGED,
        { sql: s.update("stock_state = 'known', stock_quantity = :amount, stock_counted_at = :countedAt"), args: { ...s.args, amount: m.amount, countedAt: base.countedAt } },
      );
    }
    stmts.push(...outboxInsert(m.idempotencyKey, now, m.reason));
  }
  await runBatch(payload, stmts);

  const keys = inputs.map((m) => m.idempotencyKey);
  const rows = await query(
    payload,
    `SELECT idempotency_key AS k, product_id AS pid, variant_key AS vk, delta, quantity_after AS q FROM stock_movements WHERE idempotency_key IN (${keys.map((_, i) => `:k${i}`).join(", ")})`,
    Object.fromEntries(keys.map((k, i) => [`k${i}`, k])),
  );
  const byKey = new Map(rows.map((r) => [String(r.k), r]));
  return inputs.map((m) => {
    const r = byKey.get(m.idempotencyKey);
    return { productId: m.unit.productId, variantKey: m.unit.variantKey, delta: Number(r?.delta ?? 0), quantityAfter: Number(r?.q ?? 0) };
  });
}

// ------------------------------------------------------------------ reads used by hooks and restocks

export type LiveStock = {
  stockState: "known" | "unknown";
  stockQuantity: number | null;
  stockCountedAt: string | null;
  variants: Map<string, { stockState: "known" | "unknown"; stockQuantity: number | null; stockCountedAt: string | null }>;
};

/** What the storefront reads: the product's main row, not the latest draft or version. */
export async function readLiveStock(payload: Payload, productId: string | number): Promise<LiveStock | null> {
  const pid = Number(productId);
  if (!Number.isSafeInteger(pid)) return null;
  const [row] = await query(payload, "SELECT stock_state AS s, stock_quantity AS q, stock_counted_at AS c FROM products WHERE id = :pid", { pid });
  if (!row) return null;
  const variants = await query(payload, "SELECT key AS k, stock_state AS s, stock_quantity AS q, stock_counted_at AS c FROM products_variants WHERE _parent_id = :pid", { pid });
  const shape = (r: Record<string, unknown>) => ({
    stockState: (r.s === "known" ? "known" : "unknown") as "known" | "unknown",
    stockQuantity: r.q === null || r.q === undefined ? null : Number(r.q),
    stockCountedAt: r.c === null || r.c === undefined ? null : String(r.c),
  });
  return { ...shape(row), variants: new Map(variants.map((v) => [String(v.k), shape(v)])) };
}

/** Units sold and restocked so far for one record, to cap a restock. */
export async function recordedQuantities(payload: Payload, input: { saleReason: "sale" | "reservation"; recordKey: string }): Promise<{ sold: Map<string, number>; restocked: Map<string, number> }> {
  const tally = async (prefix: string, sign: 1 | -1) => {
    const rows = await query(
      payload,
      "SELECT product_id AS pid, variant_key AS vk, SUM(delta) AS d FROM stock_movements WHERE substr(idempotency_key, 1, :len) = :prefix GROUP BY product_id, variant_key",
      { len: prefix.length, prefix },
    );
    return new Map(rows.map((r) => [unitKey({ productId: String(r.pid), variantKey: r.vk ? String(r.vk) : null }), sign * Number(r.d)]));
  };
  return {
    sold: await tally(`${input.saleReason}:${input.recordKey}:`, -1),
    restocked: await tally(`cancel_restock:${input.recordKey}:`, 1),
  };
}

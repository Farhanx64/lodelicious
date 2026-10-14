/**
 * The Clover push worker (PRD INV 06, D43): sends the durable outbox to Clover.
 *
 * Rules:
 * - Takes `pending` / `failed` rows whose `nextAttemptAt` is empty or past, oldest first, in
 *   bounded batches, under a no-overlap lock (`clover-push`).
 * - A row is *claimed* with one conditional UPDATE that pushes `nextAttemptAt` out by a lease and
 *   counts the attempt, so a second run (or a run that outlived its lock) cannot pick it up too.
 *   The final write is conditional on the row still being pending/failed.
 * - The row's `idempotencyKey` goes to Clover with every attempt.
 * - Transient failures use `afterFailure()` (30 s doubling to 6 h, dead after 8). A 429 does not
 *   count as a failed attempt: the row waits and the run stops. Three transient failures in a row
 *   stop the run (Clover is down; do not burn every row's attempts). Permanent failures are `dead`
 *   at once, except bad credentials, which stop the run and leave the rows untouched.
 * - A row with no Clover ID (or for one option of a product, which has no Clover item of its own)
 *   is not sent. It stays `failed` with a `not mapped:` message and is looked at again every six
 *   hours without using up attempts, so it goes out by itself once the ID exists.
 * - The run checkpoints (stops) before ~50 s have passed; the rest waits for the next cron run.
 *
 * It never touches the website's stock or the paid order: the stock was already right.
 */
import type { Payload } from "payload";

import { acquireJobLock, releaseJobLock } from "../inventory/job-lock";
import { query, runBatch, iso } from "../inventory/db";
import { afterFailure, backoffMs, OUTBOX_MAX_ATTEMPTS } from "../inventory/outbox";

import { isFatal, isTransient, type CloverInventoryAdapter } from "./adapter";

export const PUSH_JOB = "clover-push";
export const NOT_MAPPED_PREFIX = "not mapped:";

export type PushOptions = {
  clock?: () => number;
  batchSize?: number;
  /** Stop starting new rows after this long. */
  budgetMs?: number;
  /** How long a claimed row stays invisible to other runs. */
  leaseMs?: number;
  lockTtlMs?: number;
  maxAttempts?: number;
  maxConsecutiveTransient?: number;
  /** Read only: count what would be sent. Takes no lock and changes nothing. */
  dryRun?: boolean;
};

export type StopReason = "done" | "budget" | "throttled" | "clover_down" | "auth" | "locked";

export type PushSummary = {
  sent: number;
  failed: number;
  dead: number;
  unmapped: number;
  /** Rows another run changed first. */
  lostRace: number;
  /** Dry run: rows that would be sent / are not mapped. */
  wouldSend: number;
  stopped: StopReason;
  error: string | null;
  ok: boolean;
};

type Row = { id: number; payload: string; attempts: number | null; idempotency_key: string };

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e)).slice(0, 500);

function parse(payload: string): { productId: number; cloverId: string | null; variantKey: string | null; delta: number; quantityAfter: number } | null {
  try {
    const p = JSON.parse(payload) as Record<string, unknown>;
    const productId = Number(p.productId);
    const delta = Number(p.delta);
    if (!Number.isSafeInteger(productId) || !Number.isSafeInteger(delta)) return null;
    return {
      productId,
      cloverId: typeof p.cloverId === "string" && p.cloverId ? p.cloverId : null,
      variantKey: typeof p.variantKey === "string" && p.variantKey ? p.variantKey : null,
      delta,
      quantityAfter: Number.isFinite(Number(p.quantityAfter)) ? Number(p.quantityAfter) : 0,
    };
  } catch {
    return null;
  }
}

/** The Clover item to change, or why there is none. The product's current ID wins over the one frozen in the event. */
async function resolveTarget(payload: Payload, e: NonNullable<ReturnType<typeof parse>>): Promise<{ cloverId: string } | { unmapped: string }> {
  if (e.variantKey !== null) return { unmapped: `${NOT_MAPPED_PREFIX} option "${e.variantKey}" has no Clover item of its own` };
  const [row] = await query(payload, "SELECT clover_id AS c FROM products WHERE id = :pid", { pid: e.productId });
  const current = typeof row?.c === "string" && row.c ? row.c : null;
  const cloverId = current ?? e.cloverId;
  return cloverId ? { cloverId } : { unmapped: `${NOT_MAPPED_PREFIX} product ${e.productId} has no Clover ID` };
}

const DUE = "status IN ('pending', 'failed') AND (next_attempt_at IS NULL OR next_attempt_at <= :now)";

export async function runCloverPush(payload: Payload, adapter: CloverInventoryAdapter, opts: PushOptions = {}): Promise<PushSummary> {
  const clock = opts.clock ?? Date.now;
  const batchSize = opts.batchSize ?? 25;
  const budgetMs = opts.budgetMs ?? 50_000;
  const leaseMs = opts.leaseMs ?? 2 * 60_000;
  const maxAttempts = opts.maxAttempts ?? OUTBOX_MAX_ATTEMPTS;
  const maxTransientInARow = opts.maxConsecutiveTransient ?? 3;
  const startedAt = clock();
  const summary: PushSummary = { sent: 0, failed: 0, dead: 0, unmapped: 0, lostRace: 0, wouldSend: 0, stopped: "done", error: null, ok: true };

  if (opts.dryRun) {
    const rows = (await query(payload, `SELECT id, payload, attempts, idempotency_key FROM outbox WHERE event_type = 'stock_changed' AND ${DUE} ORDER BY created_at, id LIMIT 1000`, { now: iso(new Date(clock())) })) as unknown as Row[];
    for (const row of rows) {
      const e = parse(row.payload);
      if (!e) continue;
      if ("unmapped" in (await resolveTarget(payload, e))) summary.unmapped++;
      else summary.wouldSend++;
    }
    return summary;
  }

  const token = await acquireJobLock(payload, PUSH_JOB, opts.lockTtlMs ?? 3 * 60_000, new Date(clock()));
  if (!token) return { ...summary, stopped: "locked" };

  let transientInARow = 0;
  try {
    outer: for (;;) {
      const rows = (await query(
        payload,
        `SELECT id, payload, attempts, idempotency_key FROM outbox WHERE event_type = 'stock_changed' AND ${DUE} ORDER BY created_at, id LIMIT :n`,
        { now: iso(new Date(clock())), n: batchSize },
      )) as unknown as Row[];
      if (rows.length === 0) break;

      for (const row of rows) {
        if (clock() - startedAt >= budgetMs) {
          summary.stopped = "budget";
          break outer;
        }
        const now = new Date(clock());
        const stamp = iso(now);
        const event = parse(row.payload);
        if (!event) {
          const [r] = await runBatch(payload, [
            { sql: "UPDATE outbox SET status = 'dead', next_attempt_at = NULL, last_attempt_at = :now, attempts = COALESCE(attempts, 0) + 1, last_error = 'unreadable event payload', updated_at = :now WHERE id = :id AND status IN ('pending', 'failed')", args: { now: stamp, id: row.id } },
          ]);
          if (r.rowsAffected === 1) summary.dead++;
          else summary.lostRace++;
          continue;
        }

        const target = await resolveTarget(payload, event);
        if ("unmapped" in target) {
          const retryAt = iso(new Date(now.getTime() + backoffMs(99)));
          const [r] = await runBatch(payload, [
            { sql: "UPDATE outbox SET status = 'failed', next_attempt_at = :retry, last_attempt_at = :now, last_error = :err, updated_at = :now WHERE id = :id AND status IN ('pending', 'failed')", args: { now: stamp, retry: retryAt, err: target.unmapped, id: row.id } },
          ]);
          if (r.rowsAffected === 1) summary.unmapped++;
          else summary.lostRace++;
          continue;
        }

        // Claim: one conditional UPDATE decides who sends this row.
        const [claim] = await runBatch(payload, [
          {
            sql: `UPDATE outbox SET attempts = COALESCE(attempts, 0) + 1, last_attempt_at = :now, next_attempt_at = :lease, updated_at = :now
                  WHERE id = :id AND ${DUE}`,
            args: { now: stamp, lease: iso(new Date(now.getTime() + leaseMs)), id: row.id },
          },
        ]);
        if (claim.rowsAffected !== 1) {
          summary.lostRace++;
          continue;
        }
        const attemptNo = (row.attempts ?? 0) + 1;

        try {
          await adapter.pushStockChange({ cloverId: target.cloverId, delta: event.delta, quantityAfter: event.quantityAfter, idempotencyKey: row.idempotency_key });
        } catch (e) {
          const after = new Date(clock());
          const failStamp = iso(after);
          const msg = errorText(e);
          if (isTransient(e) && e.kind === "rate_limited") {
            // Throttled is not a failure of this row: undo the attempt, wait, and stop the run.
            const wait = Math.max(e.retryAfterMs ?? 0, 30_000);
            await runBatch(payload, [
              { sql: "UPDATE outbox SET attempts = MAX(COALESCE(attempts, 0) - 1, 0), next_attempt_at = :retry, last_error = :err, updated_at = :now WHERE id = :id AND status IN ('pending', 'failed')", args: { retry: iso(new Date(after.getTime() + wait)), err: msg, now: failStamp, id: row.id } },
            ]);
            summary.stopped = "throttled";
            break outer;
          }
          if (isFatal(e)) {
            await runBatch(payload, [
              { sql: "UPDATE outbox SET attempts = MAX(COALESCE(attempts, 0) - 1, 0), next_attempt_at = :retry, last_error = :err, updated_at = :now WHERE id = :id AND status IN ('pending', 'failed')", args: { retry: iso(new Date(after.getTime() + 5 * 60_000)), err: msg, now: failStamp, id: row.id } },
            ]);
            summary.stopped = "auth";
            summary.error = msg;
            summary.ok = false;
            break outer;
          }
          const outcome = isTransient(e) ? afterFailure(attemptNo, after, maxAttempts) : ({ status: "dead", nextAttemptAt: null } as const);
          const [r] = await runBatch(payload, [
            { sql: "UPDATE outbox SET status = :status, next_attempt_at = :next, last_error = :err, updated_at = :now WHERE id = :id AND status IN ('pending', 'failed')", args: { status: outcome.status, next: outcome.nextAttemptAt, err: msg, now: failStamp, id: row.id } },
          ]);
          if (r.rowsAffected !== 1) summary.lostRace++;
          else if (outcome.status === "dead") summary.dead++;
          else summary.failed++;
          if (isTransient(e)) {
            transientInARow++;
            if (transientInARow >= maxTransientInARow) {
              summary.stopped = "clover_down";
              summary.error = `Clover failed ${transientInARow} times in a row: ${msg}`;
              summary.ok = false;
              break outer;
            }
          } else transientInARow = 0;
          continue;
        }

        transientInARow = 0;
        const done = new Date(clock());
        const [r] = await runBatch(payload, [
          { sql: "UPDATE outbox SET status = 'sent', sent_at = :now, next_attempt_at = NULL, last_error = NULL, updated_at = :now WHERE id = :id AND status IN ('pending', 'failed')", args: { now: iso(done), id: row.id } },
        ]);
        if (r.rowsAffected === 1) summary.sent++;
        else summary.lostRace++;
      }
    }
    await releaseJobLock(payload, PUSH_JOB, token, new Date(clock()), summary.ok ? { ok: true } : { ok: false, error: summary.error ?? "failed" });
    return summary;
  } catch (e) {
    await releaseJobLock(payload, PUSH_JOB, token, new Date(clock()), { ok: false, error: errorText(e) }).catch(() => undefined);
    throw e;
  }
}

/**
 * The Clover pull worker (PRD INV 03/05, D43): reads Clover's stock page by page and brings the
 * website's counts in line, "Clover is the quantity baseline".
 *
 * Rules:
 * - Website stock changes only through `applyMovements` (mode `count`, reason `sync`): never
 *   `payload.update`. A `sync` movement writes a ledger row, marks the count known, stamps the
 *   count date with the moment Clover was read, and queues **no** outbox event (no echo).
 * - Every matched item is stamped, even when its number is unchanged (a ledger row of 0), so the
 *   freshness limit (INV 05) only ever trips for items the sync really could not read.
 * - Matching is by `products.cloverId` only, never by name. A Clover item with no website product
 *   is reported; a website product with no Clover ID, or whose ID Clover did not return, is
 *   reported and left alone (it goes stale by itself). A Clover ID shared by several website
 *   products (one Clover item split into two products) is ambiguous and is skipped and reported,
 *   as are products whose stock is kept per option (no per-option Clover IDs yet).
 * - Website sales not yet delivered to Clover are unknown to Clover, so before applying a count the
 *   outbox deltas for the product (pending, failed, dead, and rows sent since this page was read)
 *   are added to Clover's number. Counting "sent since the read began" covers a push that lands
 *   while the page is in flight; at worst a sale is counted twice, which only sells less, and the
 *   next read corrects it.
 * - Progress is a checkpoint in `sync-jobs.checkpoint` (cursor, run id, items seen). A run that stops
 *   (budget, Clover down, crash) resumes from it on the next call with the same run id, so the
 *   per-item idempotency keys `sync:<run id>:<Clover ID>` make a replayed page harmless. When a run
 *   finishes, the checkpoint holds its report (`completed: true`) for the staff view.
 * - Stops starting new pages after ~50 s. Runs under a no-overlap lock (`clover-pull`).
 */
import crypto from "node:crypto";

import type { Payload } from "payload";

import { AlreadyApplied, iso, query, runBatch } from "../inventory/db";
import { acquireJobLock, releaseJobLock } from "../inventory/job-lock";
import { applyMovements } from "../inventory/ledger";

import { isFatal, isTransient, type CloverInventoryAdapter, type CloverStockItem } from "./adapter";

export const PULL_JOB = "clover-pull";
const LIST_CAP = 50;

export type PullOptions = {
  clock?: () => number;
  pageSize?: number;
  budgetMs?: number;
  lockTtlMs?: number;
  /** A checkpoint older than this starts a fresh run instead of resuming. */
  resumeWithinMs?: number;
  /** Read and report only: no lock, no checkpoint, no stock change. */
  dryRun?: boolean;
  /** Test hook: stop after this many pages as if the budget had run out. */
  maxPages?: number;
};

export type PullReport = {
  /** Clover items read. */
  read: number;
  /** Matched and counted (or, in a dry run, that would be). */
  stamped: number;
  /** Of those, how many changed the number. */
  changed: number;
  /** Items whose pending website sales were added back. */
  withPending: number;
  alreadyApplied: number;
  /** Clover does not track stock for these. */
  untracked: number;
  clamped: number;
  unmatched: { cloverId: string; name: string | null }[];
  unmatchedTotal: number;
  ambiguous: { cloverId: string; productIds: number[] }[];
  perOption: { cloverId: string; productId: number }[];
  /** Website products with a Clover ID that Clover did not return. Filled in when the run completes. */
  missingFromClover: { productId: number; cloverId: string }[];
  /** Website products with no Clover ID at all. Filled in when the run completes. */
  withoutCloverId: number;
};

type Checkpoint = {
  runId: string;
  startedAt: string;
  cursor: string | null;
  pages: number;
  seen: string[];
  report: PullReport;
  completed: boolean;
  finishedAt?: string;
};

export type PullSummary = {
  runId: string | null;
  resumed: boolean;
  pages: number;
  completed: boolean;
  stopped: "done" | "budget" | "clover_down" | "throttled" | "auth" | "locked" | "paused";
  error: string | null;
  ok: boolean;
  report: PullReport;
};

const emptyReport = (): PullReport => ({
  read: 0,
  stamped: 0,
  changed: 0,
  withPending: 0,
  alreadyApplied: 0,
  untracked: 0,
  clamped: 0,
  unmatched: [],
  unmatchedTotal: 0,
  ambiguous: [],
  perOption: [],
  missingFromClover: [],
  withoutCloverId: 0,
});

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e)).slice(0, 500);

export async function readCheckpoint(payload: Payload, key: string): Promise<Checkpoint | null> {
  const [row] = await query(payload, "SELECT checkpoint AS c FROM sync_jobs WHERE key = :key", { key });
  if (!row || typeof row.c !== "string" || !row.c) return null;
  try {
    const c = JSON.parse(row.c) as Checkpoint;
    return c && typeof c.runId === "string" && c.report ? c : null;
  } catch {
    return null;
  }
}

async function writeCheckpoint(payload: Payload, key: string, token: string, now: Date, cp: Checkpoint): Promise<void> {
  await runBatch(payload, [{ sql: "UPDATE sync_jobs SET checkpoint = :cp, updated_at = :now WHERE key = :key AND lock_token = :token", args: { cp: JSON.stringify(cp), now: iso(now), key, token } }]);
}

type ProductIndex = { byClover: Map<string, number[]>; withVariants: Set<number>; withoutCloverId: number };

async function loadProducts(payload: Payload): Promise<ProductIndex> {
  const rows = await query(payload, "SELECT id, clover_id AS c FROM products");
  const variants = await query(payload, "SELECT DISTINCT _parent_id AS p FROM products_variants");
  const byClover = new Map<string, number[]>();
  let withoutCloverId = 0;
  for (const r of rows) {
    const c = typeof r.c === "string" ? r.c.trim() : "";
    if (!c) {
      withoutCloverId++;
      continue;
    }
    byClover.set(c, [...(byClover.get(c) ?? []), Number(r.id)]);
  }
  return { byClover, withVariants: new Set(variants.map((v) => Number(v.p))), withoutCloverId };
}

/** Website sales Clover has not been told about yet (INV 06), including ones delivered since `readStartedAt`. */
export async function pendingDelta(payload: Payload, productId: number, readStartedAt: Date): Promise<number> {
  const [row] = await query(
    payload,
    `SELECT COALESCE(SUM(CAST(json_extract(payload, '$.delta') AS INTEGER)), 0) AS s FROM outbox
     WHERE event_type = 'stock_changed' AND json_extract(payload, '$.productId') = :pid AND json_extract(payload, '$.variantKey') IS NULL
       AND (status IN ('pending', 'failed', 'dead') OR (status = 'sent' AND sent_at >= :since))`,
    { pid: productId, since: iso(readStartedAt) },
  );
  return Number(row?.s ?? 0);
}

async function currentQuantity(payload: Payload, productId: number): Promise<number | null> {
  const [row] = await query(payload, "SELECT stock_quantity AS q FROM products WHERE id = :pid", { pid: productId });
  return row?.q === null || row?.q === undefined ? null : Number(row.q);
}

export async function runCloverPull(payload: Payload, adapter: CloverInventoryAdapter, opts: PullOptions = {}): Promise<PullSummary> {
  const clock = opts.clock ?? Date.now;
  const pageSize = opts.pageSize ?? 100;
  const budgetMs = opts.budgetMs ?? 50_000;
  const resumeWithinMs = opts.resumeWithinMs ?? 24 * 3600_000;
  const startedAt = clock();
  const dry = Boolean(opts.dryRun);

  const token = dry ? "dry-run" : await acquireJobLock(payload, PULL_JOB, opts.lockTtlMs ?? 3 * 60_000, new Date(clock()));
  if (!token) return { runId: null, resumed: false, pages: 0, completed: false, stopped: "locked", error: null, ok: true, report: emptyReport() };

  const saved = dry ? null : await readCheckpoint(payload, PULL_JOB);
  const resumed = Boolean(saved && !saved.completed && clock() - Date.parse(saved.startedAt) < resumeWithinMs);
  const cp: Checkpoint = resumed
    ? (saved as Checkpoint)
    : { runId: `${new Date(clock()).toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomBytes(3).toString("hex")}`, startedAt: iso(new Date(clock())), cursor: null, pages: 0, seen: [], report: emptyReport(), completed: false };
  const report = cp.report;
  const seen = new Set(cp.seen);

  const summary: PullSummary = { runId: cp.runId, resumed, pages: 0, completed: false, stopped: "done", error: null, ok: true, report };
  let pagesThisRun = 0;

  try {
    const products = await loadProducts(payload);
    for (;;) {
      if (clock() - startedAt >= budgetMs || (opts.maxPages !== undefined && pagesThisRun >= opts.maxPages)) {
        summary.stopped = opts.maxPages !== undefined && pagesThisRun >= opts.maxPages ? "paused" : "budget";
        break;
      }
      const readStartedAt = new Date(clock());
      let page;
      try {
        page = await adapter.listItems({ cursor: cp.cursor, limit: pageSize });
      } catch (e) {
        summary.error = errorText(e);
        if (isTransient(e) && e.kind === "rate_limited") summary.stopped = "throttled";
        else if (isFatal(e)) {
          summary.stopped = "auth";
          summary.ok = false;
        } else {
          summary.stopped = "clover_down";
          summary.ok = false;
        }
        break;
      }

      for (const item of page.items) {
        report.read++;
        seen.add(item.cloverId);
        await applyItem(payload, item, products, cp.runId, readStartedAt, report, dry);
      }
      cp.pages++;
      pagesThisRun++;
      cp.cursor = page.nextCursor;
      cp.seen = [...seen];

      if (page.nextCursor === null) {
        for (const [cloverId, ids] of products.byClover) {
          if (!seen.has(cloverId)) for (const productId of ids) report.missingFromClover.push({ productId, cloverId });
        }
        report.missingFromClover.length = Math.min(report.missingFromClover.length, 200);
        report.withoutCloverId = products.withoutCloverId;
        cp.completed = true;
        cp.finishedAt = iso(new Date(clock()));
        cp.seen = [];
        summary.completed = true;
        if (!dry) await writeCheckpoint(payload, PULL_JOB, token, new Date(clock()), cp);
        break;
      }
      if (!dry) await writeCheckpoint(payload, PULL_JOB, token, new Date(clock()), cp);
    }
    summary.pages = pagesThisRun;
    if (!dry) await releaseJobLock(payload, PULL_JOB, token, new Date(clock()), summary.ok ? { ok: true } : { ok: false, error: summary.error ?? "failed" });
    return summary;
  } catch (e) {
    if (!dry) {
      // Keep what was saved after the last whole page: the next run resumes there.
      await releaseJobLock(payload, PULL_JOB, token, new Date(clock()), { ok: false, error: errorText(e) }).catch(() => undefined);
    }
    throw e;
  }
}

async function applyItem(payload: Payload, item: CloverStockItem, products: ProductIndex, runId: string, readStartedAt: Date, report: PullReport, dry: boolean): Promise<void> {
  const matches = products.byClover.get(item.cloverId);
  if (!matches) {
    report.unmatchedTotal++;
    if (report.unmatched.length < LIST_CAP) report.unmatched.push({ cloverId: item.cloverId, name: item.name });
    return;
  }
  if (matches.length > 1) {
    if (report.ambiguous.length < LIST_CAP) report.ambiguous.push({ cloverId: item.cloverId, productIds: matches });
    return;
  }
  const productId = matches[0];
  if (products.withVariants.has(productId)) {
    if (report.perOption.length < LIST_CAP) report.perOption.push({ cloverId: item.cloverId, productId });
    return;
  }
  if (item.quantity === null) {
    report.untracked++;
    return;
  }
  const pending = await pendingDelta(payload, productId, readStartedAt);
  const raw = Math.floor(item.quantity) + pending;
  const target = Math.max(0, raw);
  if (raw < 0) report.clamped++;
  if (pending !== 0) report.withPending++;
  const before = await currentQuantity(payload, productId);
  if (dry) {
    report.stamped++;
    if (before !== target) report.changed++;
    return;
  }
  try {
    await applyMovements(
      payload,
      [
        {
          unit: { productId: String(productId), variantKey: null },
          mode: "count",
          amount: target,
          reason: "sync",
          idempotencyKey: `sync:${runId}:${item.cloverId}`,
          reference: runId,
          note: pending === 0 ? `Clover count ${item.quantity}` : `Clover count ${item.quantity}, plus ${pending} sold on the website and not yet sent`,
          countedAt: readStartedAt,
        },
      ],
      new Date(),
    );
    report.stamped++;
    if (before !== target) report.changed++;
  } catch (e) {
    if (e instanceof AlreadyApplied) report.alreadyApplied++;
    else throw e;
  }
}

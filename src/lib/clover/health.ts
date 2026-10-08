/**
 * Clover sync health for staff (PRD INV 06, D43): when each job last worked, what is stuck, and
 * how old the oldest unsent change is. Read only. The system check turns it into lines.
 */
import type { Payload } from "payload";

import { query } from "../inventory/db";
import type { CheckResult } from "../system-check";

import { PULL_JOB, readCheckpoint, type PullReport } from "./pull";
import { NOT_MAPPED_PREFIX, PUSH_JOB } from "./push";

export type CloverSyncHealth = {
  push: { lastSuccessAt: string | null; lastError: string | null; status: string | null };
  pull: { lastSuccessAt: string | null; lastError: string | null; status: string | null; inProgress: boolean; lastReport: PullReport | null };
  outbox: { pending: number; failed: number; dead: number; sent: number; unmapped: number; oldestUnsentAt: string | null; oldestUnsentAgeMs: number | null; lastFailureAt: string | null; lastFailure: string | null };
};

async function job(payload: Payload, key: string) {
  const [r] = await query(payload, "SELECT status AS s, last_success_at AS ok, last_error AS e FROM sync_jobs WHERE key = :key", { key });
  return { status: r ? String(r.s) : null, lastSuccessAt: r?.ok ? String(r.ok) : null, lastError: r?.e ? String(r.e) : null };
}

export async function getCloverSyncHealth(payload: Payload, now: Date): Promise<CloverSyncHealth> {
  const counts = await query(payload, "SELECT status AS s, COUNT(*) AS n FROM outbox WHERE event_type = 'stock_changed' GROUP BY status");
  const n = (s: string) => Number(counts.find((c) => c.s === s)?.n ?? 0);
  const [unmapped] = await query(payload, "SELECT COUNT(*) AS n FROM outbox WHERE status = 'failed' AND last_error LIKE :p", { p: `${NOT_MAPPED_PREFIX}%` });
  const [oldest] = await query(payload, "SELECT MIN(created_at) AS t FROM outbox WHERE status IN ('pending', 'failed') AND (last_error IS NULL OR last_error NOT LIKE :p)", { p: `${NOT_MAPPED_PREFIX}%` });
  const [lastFail] = await query(payload, "SELECT last_attempt_at AS t, last_error AS e FROM outbox WHERE last_error IS NOT NULL AND last_error NOT LIKE :p ORDER BY last_attempt_at DESC LIMIT 1", { p: `${NOT_MAPPED_PREFIX}%` });
  const oldestAt = oldest?.t ? String(oldest.t) : null;
  const push = await job(payload, PUSH_JOB);
  const pull = await job(payload, PULL_JOB);
  const cp = await readCheckpoint(payload, PULL_JOB);
  const unmappedCount = Number(unmapped?.n ?? 0);
  return {
    push: { lastSuccessAt: push.lastSuccessAt, lastError: push.lastError, status: push.status },
    pull: { ...pull, inProgress: Boolean(cp && !cp.completed), lastReport: cp?.completed ? cp.report : null },
    outbox: {
      pending: n("pending"),
      failed: Math.max(0, n("failed") - unmappedCount),
      dead: n("dead"),
      sent: n("sent"),
      unmapped: unmappedCount,
      oldestUnsentAt: oldestAt,
      oldestUnsentAgeMs: oldestAt ? Math.max(0, now.getTime() - Date.parse(oldestAt)) : null,
      lastFailureAt: lastFail?.t ? String(lastFail.t) : null,
      lastFailure: lastFail?.e ? String(lastFail.e) : null,
    },
  };
}

/** Unsent changes older than this make the system check fail (Clover is not receiving sales). */
export const STALE_UNSENT_MS = 60 * 60_000;

const minutes = (ms: number) => `${Math.round(ms / 60_000)} min`;

/** Lines for /ops/system-check. Not configured is informational (ok), since the website works without Clover. */
export function cloverHealthChecks(health: CloverSyncHealth, configured: boolean): CheckResult[] {
  const o = health.outbox;
  if (!configured) {
    return [{ check: "Clover sync", expected: "configured before launch", actual: `not configured; ${o.pending + o.failed} change(s) waiting, ${o.dead} dead`, ok: o.dead === 0 }];
  }
  const stale = o.oldestUnsentAgeMs !== null && o.oldestUnsentAgeMs > STALE_UNSENT_MS;
  return [
    {
      check: "Clover sync: outbox",
      expected: `no dead events; nothing unsent longer than ${minutes(STALE_UNSENT_MS)}`,
      actual: `${o.pending} pending, ${o.failed} retrying, ${o.dead} dead, ${o.unmapped} without a Clover ID; oldest unsent ${o.oldestUnsentAgeMs === null ? "none" : minutes(o.oldestUnsentAgeMs)}`,
      ok: o.dead === 0 && !stale,
    },
    {
      check: "Clover sync: last stock read",
      expected: "a successful read recently",
      actual: health.pull.lastSuccessAt ? `${health.pull.lastSuccessAt}${health.pull.lastError ? ` (last run failed: ${health.pull.lastError})` : ""}` : "never",
      ok: Boolean(health.pull.lastSuccessAt) && !health.pull.lastError,
    },
    {
      check: "Clover sync: last send",
      expected: "a successful send recently",
      actual: health.push.lastSuccessAt ? `${health.push.lastSuccessAt}${health.push.lastError ? ` (last run failed: ${health.push.lastError})` : ""}` : "never",
      ok: Boolean(health.push.lastSuccessAt) && !health.push.lastError,
    },
  ];
}

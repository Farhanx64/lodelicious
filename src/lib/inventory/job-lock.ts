/**
 * No-overlap lock for cron jobs, kept in the `sync-jobs` row for the job (PRD INF 03/04, D40).
 * One conditional UPDATE decides who owns the job, so two runs can never both start; a run that
 * dies leaves the lock to expire after `ttlMs`.
 */
import crypto from "node:crypto";

import type { Payload } from "payload";

import { iso, runBatch } from "./db";

/** The lock token when this run owns the job, or null when another run holds it. */
export async function acquireJobLock(payload: Payload, key: string, ttlMs: number, now: Date): Promise<string | null> {
  const token = crypto.randomUUID();
  const stamp = iso(now);
  const results = await runBatch(payload, [
    { sql: "INSERT OR IGNORE INTO sync_jobs (key, status, attempts, updated_at, created_at) VALUES (:key, 'idle', 0, :now, :now)", args: { key, now: stamp } },
    {
      sql: `UPDATE sync_jobs SET status = 'running', lock_token = :token, locked_until = :until, attempts = COALESCE(attempts, 0) + 1, updated_at = :now
            WHERE key = :key AND (locked_until IS NULL OR locked_until <= :now)`,
      args: { key, token, until: iso(new Date(now.getTime() + ttlMs)), now: stamp },
    },
  ]);
  return results[1].rowsAffected === 1 ? token : null;
}

/** Give the lock back and record how the run went. Does nothing if the lock has since passed to another run. */
export async function releaseJobLock(payload: Payload, key: string, token: string, now: Date, outcome: { ok: true } | { ok: false; error: string }): Promise<void> {
  await runBatch(payload, [
    {
      sql: `UPDATE sync_jobs SET status = :status, lock_token = NULL, locked_until = NULL,
              last_success_at = CASE WHEN :ok = 1 THEN :now ELSE last_success_at END,
              last_error = CASE WHEN :ok = 1 THEN NULL ELSE :error END, updated_at = :now
            WHERE key = :key AND lock_token = :token`,
      args: { key, token, now: iso(now), status: outcome.ok ? "idle" : "failed", ok: outcome.ok ? 1 : 0, error: outcome.ok ? null : outcome.error.slice(0, 500) },
    },
  ]);
}

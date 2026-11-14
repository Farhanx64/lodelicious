/**
 * The scheduled jobs, as functions (D51). Two callers share them so the work is written once:
 *
 * - the command line: `npx payload run scripts/<name>.ts` (a cron job on a Node host, or by hand);
 * - Cloudflare: a Cron Trigger calls the Worker's `scheduled` handler (`cloudflare-worker.mjs`),
 *   which asks `/ops/cron/<name>` to run the job inside the app.
 *
 * Every job is safe to run at any time and as often as you like. The ones that must not overlap
 * take a lock in `sync-jobs`; a second run reports "another run is in progress" and does nothing.
 */
import type { Payload } from "payload";

import { CART_MAX_AGE_DAYS, cartCutoff, purgeStaleCarts } from "../checkout/purge-carts";
import { getCloverAdapter } from "../clover/get-adapter";
import { printPendingOrders } from "../clover/order-print";
import { runCloverPull } from "../clover/pull";
import { runCloverPush } from "../clover/push";
import { sendPendingEmails } from "../email/pending";
import { acquireJobLock, releaseJobLock } from "../inventory/job-lock";
import { expireHolds } from "../inventory/ledger";
import { reconcilePaidHeld } from "../inventory/settle";
import { getPaymentProvider } from "../payments";
import { reconcileUnknownPayments } from "../payments/reconcile";

export const JOB_NAMES = ["release-expired-holds", "send-pending-emails", "purge-carts", "clover-push", "clover-pull"] as const;

export type JobName = (typeof JOB_NAMES)[number];

export const isJobName = (value: string): value is JobName => (JOB_NAMES as readonly string[]).includes(value);

/** `ok: false` means the run failed and should be looked at (exit code 1 on the command line). */
export type JobResult = { ok: boolean; lines: string[] };

export type JobOptions = { dryRun?: boolean; env?: Record<string, string | undefined> };

const done = (...lines: string[]): JobResult => ({ ok: true, lines });
const failed = (...lines: string[]): JobResult => ({ ok: false, lines });

/** Runs `work` under the job's no-overlap lock and records how it went. */
async function locked(payload: Payload, job: JobName, lockMs: number, work: () => Promise<string>): Promise<JobResult> {
  const token = await acquireJobLock(payload, job, lockMs, new Date());
  if (!token) return done("another run is in progress; nothing to do.");
  try {
    const line = await work();
    await releaseJobLock(payload, job, token, new Date(), { ok: true });
    return done(line);
  } catch (e) {
    await releaseJobLock(payload, job, token, new Date(), { ok: false, error: (e as Error).message }).catch(() => undefined);
    return failed(`failed: ${(e as Error).stack ?? (e as Error).message}`);
  }
}

/**
 * Release expired stock holds, and finish any paid record whose stock was never taken (INV 04).
 * Expired holds are already ignored wherever sellable stock is worked out, so this only keeps the
 * table small and tidies the admin list. The reconcile step covers a paid order or reservation
 * whose request stopped before its stock was taken, and a payment result that arrived after its
 * hold had expired: it takes the stock if it is still there, and otherwise flags the paid record
 * for staff (never charging again).
 */
function releaseExpiredHolds(payload: Payload, env: Record<string, string | undefined> = process.env): Promise<JobResult> {
  return locked(payload, "release-expired-holds", 5 * 60_000, async () => {
    // First, payments whose result was unknown: Clover may say they went through (D54).
    const payments = await reconcileUnknownPayments(payload, getPaymentProvider(env));
    const now = new Date();
    const reconciled = await reconcilePaidHeld(payload, now);
    const holds = await expireHolds(payload, now);
    return (
      `${holds.expired} hold(s) expired, ${holds.pruned} old hold(s) removed; ` +
      `${reconciled.checked} paid record(s) checked, ${reconciled.committed} took their stock, ${reconciled.needsAttention} need staff attention; ` +
      `${payments.checked} unknown payment(s) looked up, ${payments.paid} confirmed paid.`
    );
  });
}

/**
 * Send any transactional email that is owed but not yet sent (D44), then retry Clover printing (D60). Each email is claimed with a
 * marker on the record before it is sent, so nothing is sent twice. Until a sending service is
 * connected the console adapter only logs; those emails still count as handled.
 */
function sendPending(payload: Payload): Promise<JobResult> {
  return locked(payload, "send-pending-emails", 10 * 60_000, async () => {
    const r = await sendPendingEmails(payload);
    const line = `${r.records} record(s) checked, ${r.sent} email(s) handed to the transport, ${r.failed} failed (will retry next run).`;
    // Paid web orders not yet on the Clover device (D60); nothing while CLOVER_ORDER_PRINT is off.
    const p = await printPendingOrders(payload).catch((e: unknown) => ({ checked: 0, printed: 0, failed: 1, error: (e as Error).message }));
    return p.checked || p.failed ? `${line} Clover printing: ${p.printed} printed, ${p.failed} failed.` : line;
  });
}

/** Delete shopping bags nobody has touched for 30 days (D41, A15). Only the `carts` table is touched. */
async function purgeCarts(payload: Payload): Promise<JobResult> {
  const deleted = await purgeStaleCarts(payload, cartCutoff(new Date()));
  return done(`Deleted ${deleted} shopping bag${deleted === 1 ? "" : "s"} untouched for over ${CART_MAX_AGE_DAYS} days.`);
}

type ConfiguredClover = Exclude<ReturnType<typeof getCloverAdapter>, { kind: "none" }>;

function cloverAdapter(env: Record<string, string | undefined>): { result: JobResult } | { adapter: ConfiguredClover } {
  let choice;
  try {
    choice = getCloverAdapter(env);
  } catch (e) {
    return { result: failed((e as Error).message) };
  }
  if (choice.kind === "none") return { result: done(`${choice.reason}; nothing to do.`) };
  return { adapter: choice };
}

/** Send queued stock changes to Clover (INV 06, D43). Does nothing while Clover is not configured. */
async function cloverPush(payload: Payload, { dryRun = false, env = process.env }: JobOptions): Promise<JobResult> {
  const picked = cloverAdapter(env);
  if ("result" in picked) return picked.result;
  const choice = picked.adapter;
  try {
    const s = await runCloverPush(payload, choice.adapter, { dryRun });
    if (s.stopped === "locked") return done("another run is in progress; nothing to do.");
    const line = dryRun
      ? `dry run (${choice.kind}): ${s.wouldSend} change(s) would be sent, ${s.unmapped} have no Clover ID.`
      : `(${choice.kind}) sent ${s.sent}, retrying ${s.failed}, dead ${s.dead}, no Clover ID ${s.unmapped}; stopped: ${s.stopped}${s.error ? ` (${s.error})` : ""}.`;
    return { ok: s.ok, lines: [line] };
  } catch (e) {
    return failed(`failed: ${(e as Error).stack ?? (e as Error).message}`);
  }
}

/** Read Clover's stock into the website (INV 03/05, D43). Does nothing while Clover is not configured. */
async function cloverPull(payload: Payload, { dryRun = false, env = process.env }: JobOptions): Promise<JobResult> {
  const picked = cloverAdapter(env);
  if ("result" in picked) return picked.result;
  const choice = picked.adapter;
  try {
    const s = await runCloverPull(payload, choice.adapter, { dryRun });
    if (s.stopped === "locked") return done("another run is in progress; nothing to do.");
    const r = s.report;
    const lines = [
      `${dryRun ? "dry run " : ""}(${choice.kind}) run ${s.runId}${s.resumed ? " (resumed)" : ""}: ${s.pages} page(s), ${r.read} item(s) read, ${r.stamped} counted, ${r.changed} changed, ` +
        `${r.withPending} with unsent sales added back; ${r.unmatchedTotal} Clover item(s) not on the website, ${r.ambiguous.length} shared by several products, ` +
        `${r.perOption.length} kept per option, ${r.untracked} without tracked stock; ` +
        (s.completed ? `finished: ${r.missingFromClover.length} website product(s) missing from Clover, ${r.withoutCloverId} without a Clover ID.` : `not finished (${s.stopped}); will resume.`) +
        (s.error ? ` Error: ${s.error}` : ""),
    ];
    if (r.unmatched.length) lines.push(`not on the website: ${r.unmatched.map((u) => `${u.cloverId}${u.name ? ` (${u.name})` : ""}`).join(", ")}`);
    return { ok: s.ok, lines };
  } catch (e) {
    return failed(`failed: ${(e as Error).stack ?? (e as Error).message}`);
  }
}

export async function runJob(payload: Payload, job: JobName, options: JobOptions = {}): Promise<JobResult> {
  switch (job) {
    case "release-expired-holds":
      return releaseExpiredHolds(payload, options.env);
    case "send-pending-emails":
      return sendPending(payload);
    case "purge-carts":
      return purgeCarts(payload);
    case "clover-push":
      return cloverPush(payload, options);
    case "clover-pull":
      return cloverPull(payload, options);
  }
}

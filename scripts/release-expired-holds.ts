/**
 * Release expired stock holds, and finish any paid record whose stock was never taken (INV 04).
 *
 *   npx payload run scripts/release-expired-holds.ts
 *
 * Run it from a cPanel cron job every few minutes. Expired holds are already ignored wherever
 * sellable stock is worked out, so this only keeps the table small and tidies the admin list. The
 * reconcile step covers a paid order or reservation whose process stopped before its stock was
 * taken, and a payment result that arrived after its hold had expired: it takes the stock if it
 * is still there, and otherwise flags the paid record for staff (never charging again).
 *
 * A lock in `sync-jobs` stops two runs overlapping; a second run exits at once.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { acquireJobLock, releaseJobLock } from "../src/lib/inventory/job-lock";
import { expireHolds } from "../src/lib/inventory/ledger";
import { reconcilePaidHeld } from "../src/lib/inventory/settle";

const JOB = "release-expired-holds";
const LOCK_MS = 5 * 60_000;

const payload = await getPayload({ config });
const now = new Date();
const token = await acquireJobLock(payload, JOB, LOCK_MS, now);
if (!token) {
  console.log(`[${JOB}] another run is in progress; nothing to do.`);
  process.exit(0);
}

try {
  const reconciled = await reconcilePaidHeld(payload, now);
  const holds = await expireHolds(payload, now);
  await releaseJobLock(payload, JOB, token, new Date(), { ok: true });
  console.log(
    `[${JOB}] ${holds.expired} hold(s) expired, ${holds.pruned} old hold(s) removed; ` +
      `${reconciled.checked} paid record(s) checked, ${reconciled.committed} took their stock, ${reconciled.needsAttention} need staff attention.`,
  );
  process.exit(0);
} catch (e) {
  await releaseJobLock(payload, JOB, token, new Date(), { ok: false, error: (e as Error).message }).catch(() => undefined);
  console.error(`[${JOB}] failed:`, e);
  process.exit(1);
}

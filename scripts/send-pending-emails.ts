/**
 * Send any transactional email that is owed but not yet sent (D44): a paid order or reservation whose
 * confirmation failed, an inquiry whose receipt failed, a payment left unknown, stock needing attention.
 *
 *   npx payload run scripts/send-pending-emails.ts
 *
 * Run it from a cPanel cron job every 10 minutes or so. It is safe to run at any time and as often as you
 * like: each email is claimed with a marker on the record before it is sent, so nothing is sent twice. Until
 * a sending service is connected (see EMAIL_TRANSPORT in .env.example) the console adapter only logs; those emails
 * still count as handled, so connecting a service later does not email old orders.
 *
 * A lock in `sync-jobs` stops two runs overlapping; a second run exits at once.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { acquireJobLock, releaseJobLock } from "../src/lib/inventory/job-lock";
import { sendPendingEmails } from "../src/lib/email/pending";

const JOB = "send-pending-emails";
const LOCK_MS = 10 * 60_000;

const payload = await getPayload({ config });
const token = await acquireJobLock(payload, JOB, LOCK_MS, new Date());
if (!token) {
  console.log(`[${JOB}] another run is in progress; nothing to do.`);
  process.exit(0);
}

try {
  const r = await sendPendingEmails(payload);
  await releaseJobLock(payload, JOB, token, new Date(), { ok: true });
  console.log(`[${JOB}] ${r.records} record(s) checked, ${r.sent} email(s) handed to the transport, ${r.failed} failed (will retry next run).`);
  process.exit(0);
} catch (e) {
  await releaseJobLock(payload, JOB, token, new Date(), { ok: false, error: (e as Error).message }).catch(() => undefined);
  console.error(`[${JOB}] failed:`, e);
  process.exit(1);
}

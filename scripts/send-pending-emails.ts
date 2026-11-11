/**
 * Send any transactional email that is owed but not yet sent (D44): a paid order or reservation whose
 * confirmation failed, an inquiry whose receipt failed, a payment left unknown, stock needing attention.
 *
 *   npx payload run scripts/send-pending-emails.ts
 *
 * On Cloudflare a Cron Trigger runs the same job every 10 minutes (D51); this command is for running
 * it by hand or from a cron job on a Node host. It is safe to run at any time and as often as you
 * like: see src/lib/jobs/run.ts. A lock in `sync-jobs` stops two runs overlapping.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { runJob } from "../src/lib/jobs/run";

const JOB = "send-pending-emails";

const payload = await getPayload({ config });
const result = await runJob(payload, JOB);
for (const line of result.lines) (result.ok ? console.log : console.error)(`[${JOB}] ${line}`);
process.exit(result.ok ? 0 : 1);

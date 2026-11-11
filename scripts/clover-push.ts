/**
 * Send queued stock changes to Clover (INV 06, D43).
 *
 *   npx payload run scripts/clover-push.ts
 *   CLOVER_DRY_RUN=1 npx payload run scripts/clover-push.ts     (count what would be sent; changes nothing)
 *
 * Meant to run every minute or two once the sync is verified (on Cloudflare: add its Cron Trigger,
 * see wrangler.jsonc and D51). It takes a no-overlap lock, works for about 50 seconds at most, and
 * leaves the rest for the next run. Exit code 1 means Clover could not be reached repeatedly or
 * refused the credentials; staff see the same thing in /ops/system-check. Does nothing (exit 0)
 * while Clover is not configured. See docs/clover-sync-needs.md.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { runJob } from "../src/lib/jobs/run";

const JOB = "clover-push";

const payload = await getPayload({ config });
const result = await runJob(payload, JOB, { dryRun: process.env.CLOVER_DRY_RUN === "1" });
for (const line of result.lines) (result.ok ? console.log : console.error)(`[${JOB}] ${line}`);
process.exit(result.ok ? 0 : 1);

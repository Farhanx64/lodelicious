/**
 * Release expired stock holds, and finish any paid record whose stock was never taken (INV 04).
 *
 *   npx payload run scripts/release-expired-holds.ts
 *
 * On Cloudflare a Cron Trigger runs the same job every 5 minutes (D51); this command is for running
 * it by hand or from a cron job on a Node host. What it does is described in src/lib/jobs/run.ts.
 * A lock in `sync-jobs` stops two runs overlapping; a second run exits at once.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { runJob } from "../src/lib/jobs/run";

const JOB = "release-expired-holds";

const payload = await getPayload({ config });
const result = await runJob(payload, JOB);
for (const line of result.lines) (result.ok ? console.log : console.error)(`[${JOB}] ${line}`);
process.exit(result.ok ? 0 : 1);

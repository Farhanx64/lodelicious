/**
 * Delete shopping bags nobody has touched for 30 days (D41, A15).
 *
 *   npx payload run scripts/purge-carts.ts
 *
 * On Cloudflare a Cron Trigger runs the same job once a day (D51). Only the `carts` table is
 * touched. Orders and reservations are never deleted by this.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { runJob } from "../src/lib/jobs/run";

const JOB = "purge-carts";

const payload = await getPayload({ config });
const result = await runJob(payload, JOB);
for (const line of result.lines) (result.ok ? console.log : console.error)(`[${JOB}] ${line}`);
process.exit(result.ok ? 0 : 1);

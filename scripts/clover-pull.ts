/**
 * Read Clover's stock into the website (INV 03/05, D43).
 *
 *   npx payload run scripts/clover-pull.ts
 *   CLOVER_DRY_RUN=1 npx payload run scripts/clover-pull.ts     (reads Clover, reports, changes nothing)
 *
 * Meant to run every 5 to 15 minutes (Lody's choice) once the sync is verified (on Cloudflare: add
 * its Cron Trigger, see wrangler.jsonc and D51). It takes a no-overlap lock, works for about 50
 * seconds at most and saves a checkpoint, so a long catalog finishes over several runs. Stock
 * reaches the website only through the inventory ledger (reason "sync"). Exit code 1 means Clover
 * could not be reached or refused the credentials. Does nothing (exit 0) while Clover is not
 * configured. See docs/clover-sync-needs.md.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { runJob } from "../src/lib/jobs/run";

const JOB = "clover-pull";

const payload = await getPayload({ config });
const result = await runJob(payload, JOB, { dryRun: process.env.CLOVER_DRY_RUN === "1" });
for (const line of result.lines) (result.ok ? console.log : console.error)(`[${JOB}] ${line}`);
process.exit(result.ok ? 0 : 1);

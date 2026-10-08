/**
 * Send queued stock changes to Clover (INV 06, D43).
 *
 *   npx payload run scripts/clover-push.ts
 *   CLOVER_DRY_RUN=1 npx payload run scripts/clover-push.ts     (count what would be sent; changes nothing)
 *
 * Run it from a cPanel cron job every minute or two. It takes a no-overlap lock, works for about
 * 50 seconds at most, and leaves the rest for the next run. Exit code 1 means Clover could not be
 * reached repeatedly or refused the credentials; staff see the same thing in /ops/system-check.
 * Does nothing (exit 0) while Clover is not configured. See docs/clover-sync-needs.md.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { getCloverAdapter } from "../src/lib/clover/get-adapter";
import { runCloverPush } from "../src/lib/clover/push";

const TAG = "clover-push";
const dryRun = process.env.CLOVER_DRY_RUN === "1";

let choice;
try {
  choice = getCloverAdapter(process.env);
} catch (e) {
  console.error(`[${TAG}] ${(e as Error).message}`);
  process.exit(1);
}
if (choice.kind === "none") {
  console.log(`[${TAG}] ${choice.reason}; nothing to do.`);
  process.exit(0);
}

const payload = await getPayload({ config });
try {
  const s = await runCloverPush(payload, choice.adapter, { dryRun });
  if (s.stopped === "locked") {
    console.log(`[${TAG}] another run is in progress; nothing to do.`);
    process.exit(0);
  }
  console.log(
    dryRun
      ? `[${TAG}] dry run (${choice.kind}): ${s.wouldSend} change(s) would be sent, ${s.unmapped} have no Clover ID.`
      : `[${TAG}] (${choice.kind}) sent ${s.sent}, retrying ${s.failed}, dead ${s.dead}, no Clover ID ${s.unmapped}; stopped: ${s.stopped}${s.error ? ` (${s.error})` : ""}.`,
  );
  process.exit(s.ok ? 0 : 1);
} catch (e) {
  console.error(`[${TAG}] failed:`, e);
  process.exit(1);
}

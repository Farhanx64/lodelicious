/**
 * Read Clover's stock into the website (INV 03/05, D43).
 *
 *   npx payload run scripts/clover-pull.ts
 *   CLOVER_DRY_RUN=1 npx payload run scripts/clover-pull.ts     (reads Clover, reports, changes nothing)
 *
 * Run it from a cPanel cron job every 5 to 15 minutes (Lody's choice). It takes a no-overlap lock,
 * works for about 50 seconds at most and saves a checkpoint, so a long catalog finishes over
 * several runs. Stock reaches the website only through the inventory ledger (reason "sync").
 * Exit code 1 means Clover could not be reached or refused the credentials. Does nothing (exit 0)
 * while Clover is not configured. See docs/clover-sync-needs.md.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { getCloverAdapter } from "../src/lib/clover/get-adapter";
import { runCloverPull } from "../src/lib/clover/pull";

const TAG = "clover-pull";
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
  const s = await runCloverPull(payload, choice.adapter, { dryRun });
  if (s.stopped === "locked") {
    console.log(`[${TAG}] another run is in progress; nothing to do.`);
    process.exit(0);
  }
  const r = s.report;
  console.log(
    `[${TAG}] ${dryRun ? "dry run " : ""}(${choice.kind}) run ${s.runId}${s.resumed ? " (resumed)" : ""}: ${s.pages} page(s), ${r.read} item(s) read, ${r.stamped} counted, ${r.changed} changed, ` +
      `${r.withPending} with unsent sales added back; ${r.unmatchedTotal} Clover item(s) not on the website, ${r.ambiguous.length} shared by several products, ` +
      `${r.perOption.length} kept per option, ${r.untracked} without tracked stock; ` +
      (s.completed ? `finished: ${r.missingFromClover.length} website product(s) missing from Clover, ${r.withoutCloverId} without a Clover ID.` : `not finished (${s.stopped}); will resume.`) +
      (s.error ? ` Error: ${s.error}` : ""),
  );
  if (r.unmatched.length) console.log(`[${TAG}] not on the website: ${r.unmatched.map((u) => `${u.cloverId}${u.name ? ` (${u.name})` : ""}`).join(", ")}`);
  process.exit(s.ok ? 0 : 1);
} catch (e) {
  console.error(`[${TAG}] failed:`, e);
  process.exit(1);
}

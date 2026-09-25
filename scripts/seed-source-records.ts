/**
 * Import the verbatim source evidence (data/source/*.csv) into Source records.
 *
 *   npm run seed:sources
 *
 * Safe to re-run: existing refs are skipped, and a ref whose evidence changed is reported as a
 * conflict for review instead of being overwritten. Nothing imported here is purchasable.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { importSourceRecords } from "../src/lib/source-import";
import { readSourceRows } from "../src/lib/source-files";

const payload = await getPayload({ config });
const report = await importSourceRecords(payload, readSourceRows());

console.log(`created:   ${report.created.length}`);
console.log(`unchanged: ${report.unchanged.length}`);
console.log(`conflicts: ${report.conflicts.length}`);
for (const c of report.conflicts) {
  console.log(`  ${c.ref}: ${c.fields.join(", ")} differ — review before changing`);
}
process.exit(report.conflicts.length > 0 ? 1 : 0);

/**
 * Check this shell/cron context against the host requirements, including database access.
 *
 *   npm run doctor
 *
 * The cPanel Node app can carry different NODE_OPTIONS/env from SSH; the web context is
 * checked at /ops/system-check (owner/manager login required).
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { currentRuntimeEnv } from "../src/lib/runtime-env";
import { evaluate } from "../src/lib/system-check";

const results = evaluate(currentRuntimeEnv());

try {
  const payload = await getPayload({ config });
  await payload.count({ collection: "users", overrideAccess: true });
  results.push({ check: "Database", expected: "reachable", actual: "reachable", ok: true });
} catch (err) {
  results.push({ check: "Database", expected: "reachable", actual: (err as Error).message, ok: false });
}

console.table(results.map((r) => ({ ...r, ok: r.ok ? "pass" : "FAIL" })));
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `${failed} check(s) failed.` : "All checks passed.");
process.exit(failed ? 1 : 0);

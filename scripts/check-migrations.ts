/**
 * Fail loudly if any migration in /migrations is not recorded in the database.
 *
 *   npm run migrate      (runs `payload migrate` and then this check)
 *
 * `payload migrate` has been seen to exit 0 without applying anything (for example when it
 * would need an interactive confirmation that a non-TTY shell cancels). Never trust its exit
 * code alone; this check is what deploys and seed scripts rely on.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { migrations } from "../migrations";

const payload = await getPayload({ config });
let applied: string[] = [];
try {
  const { docs } = await payload.find({ collection: "payload-migrations", limit: 0, pagination: false, overrideAccess: true });
  applied = docs.filter((d) => Number(d.batch) > 0).map((d) => String(d.name));
} catch (err) {
  console.error(`Could not read applied migrations: ${(err as Error).message}`);
  process.exit(1);
}

const pending = migrations.map((m) => m.name).filter((name) => !applied.includes(name));
if (pending.length > 0) {
  console.error(`Pending migrations (NOT applied): ${pending.join(", ")}`);
  process.exit(1);
}
console.log(`All ${migrations.length} migrations applied.`);
process.exit(0);

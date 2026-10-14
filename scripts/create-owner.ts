/**
 * Create the first owner account at deploy time, before anyone can reach /admin (D41, A03).
 *
 *   OWNER_EMAIL=lody@example.com OWNER_PASSWORD='a long passphrase' npx payload run scripts/create-owner.ts
 *
 * Refuses if any user already exists. Optionally set FIRST_OWNER_EMAIL to the same address in the
 * app's environment: the first account can then only ever be that address, even if this script is
 * skipped and someone reaches the create-first-user screen. Remove OWNER_PASSWORD afterwards.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { createFirstOwner } from "../src/lib/owner-setup";

const payload = await getPayload({ config });
const result = await createFirstOwner(payload, process.env);

if (result.ok) {
  console.log(`Owner account created for ${result.email}.`);
  console.log("Remove OWNER_PASSWORD from the environment now, and keep FIRST_OWNER_EMAIL set if you want the first-account guard to stay on.");
  process.exit(0);
}
console.error(`No account created. ${result.error}`);
process.exit(1);

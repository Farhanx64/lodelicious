/**
 * Delete shopping bags nobody has touched for 30 days (D41, A15). A cron candidate, e.g. daily:
 *
 *   npx payload run scripts/purge-carts.ts
 *
 * Only the `carts` table is touched. Orders and reservations are never deleted by this.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { CART_MAX_AGE_DAYS, cartCutoff, purgeStaleCarts } from "../src/lib/checkout/purge-carts";

const payload = await getPayload({ config });
const deleted = await purgeStaleCarts(payload, cartCutoff(new Date()));
console.log(`Deleted ${deleted} shopping bag${deleted === 1 ? "" : "s"} untouched for over ${CART_MAX_AGE_DAYS} days.`);
process.exit(0);

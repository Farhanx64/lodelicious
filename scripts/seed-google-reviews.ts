/**
 * Load the starting Google reviews into Website → Reviews (D52).
 *
 *   npm run seed:reviews
 *
 * Only when the Reviews collection is empty: once any review exists (seeded or added by staff),
 * it does nothing, so it is safe to re-run and never brings back a deleted review. It writes to
 * the reviews collection only.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { loadGoogleReviews, seedGoogleReviews } from "../src/lib/reviews/seed";

const payload = await getPayload({ config });
const report = await seedGoogleReviews(payload, loadGoogleReviews());
console.log(report.skipped ? "reviews: the collection already has reviews; nothing added" : `reviews: ${report.created} created`);
process.exit(0);

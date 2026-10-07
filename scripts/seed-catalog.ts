/**
 * Load the starting catalog: source evidence, categories, photos and products.
 *
 *   npm run seed:catalog
 *
 * Create-only and safe to re-run. After the first run, manage everything in /admin — this
 * script never changes or deletes what staff have edited.
 *
 * On a production database that already has products it refuses to run (it would bring back
 * anything staff deleted or renamed) unless you pass --force or set SEED_FORCE=1 (D41).
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { checkSeedAllowed } from "../src/lib/catalog/seed-guard";
import { loadCatalogSeed, seedCatalog } from "../src/lib/catalog/seed";
import { importSourceRecords } from "../src/lib/source-import";
import { readSourceRows } from "../src/lib/source-files";

const payload = await getPayload({ config });

// First thing, before anything is written.
const guard = checkSeedAllowed({
  env: process.env,
  argv: process.argv.slice(2),
  productCount: (await payload.count({ collection: "products", overrideAccess: true })).totalDocs,
});
if (!guard.allowed) {
  console.error(guard.reason);
  process.exit(1);
}
if (guard.forced) console.warn("SEED_FORCE: seeding a production database that already has products.");

const sources = await importSourceRecords(payload, readSourceRows());
console.log(`source records: ${sources.created.length} created, ${sources.unchanged.length} unchanged, ${sources.conflicts.length} conflicts`);
for (const c of sources.conflicts) console.log(`  ${c.ref}: ${c.fields.join(", ")} differ — review before changing`);

const { seed, allergens, assetsDir } = loadCatalogSeed();
const report = await seedCatalog(payload, seed, allergens, assetsDir);
for (const [kind, r] of Object.entries({ categories: report.categories, media: report.media, products: report.products })) {
  console.log(`${kind}: ${r.created.length} created, ${r.existing.length} already present (left unchanged)`);
}
if (report.presentationImages.length) console.log(`presentation photos linked: ${report.presentationImages.join(", ")}`);
if (report.taxClass) console.log(`tax class created (approved): ${report.taxClass}`);
if (report.homePage.length) console.log(`home page placeholder photos set: ${report.homePage.join(", ")}`);
if (report.closedDates.length) console.log(`closed dates set (checkout was offering these days): ${report.closedDates.join(", ")}`);
process.exit(0);

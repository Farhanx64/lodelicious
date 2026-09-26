/**
 * Load the starting catalog: source evidence, categories, photos and products.
 *
 *   npm run seed:catalog
 *
 * Create-only and safe to re-run. After the first run, manage everything in /admin — this
 * script never changes or deletes what staff have edited.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { loadCatalogSeed, seedCatalog } from "../src/lib/catalog/seed";
import { importSourceRecords } from "../src/lib/source-import";
import { readSourceRows } from "../src/lib/source-files";

const payload = await getPayload({ config });

const sources = await importSourceRecords(payload, readSourceRows());
console.log(`source records: ${sources.created.length} created, ${sources.unchanged.length} unchanged, ${sources.conflicts.length} conflicts`);
for (const c of sources.conflicts) console.log(`  ${c.ref}: ${c.fields.join(", ")} differ — review before changing`);

const { seed, allergens, assetsDir } = loadCatalogSeed();
const report = await seedCatalog(payload, seed, allergens, assetsDir);
for (const [kind, r] of Object.entries({ categories: report.categories, media: report.media, products: report.products })) {
  console.log(`${kind}: ${r.created.length} created, ${r.existing.length} already present (left unchanged)`);
}
if (report.presentationImages.length) console.log(`presentation photos linked: ${report.presentationImages.join(", ")}`);
process.exit(0);

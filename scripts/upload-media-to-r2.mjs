/**
 * Copy the uploaded photos from the Node host's media folder into the R2 bucket (D51).
 *
 *   node scripts/upload-media-to-r2.mjs .data/media                          (local emulation: rehearse)
 *   CLOUDFLARE_ENV=remote node scripts/upload-media-to-r2.mjs .data/media    (the real bucket; needs `wrangler login`)
 *
 * Every file goes in under its own file name, which is where Payload's R2 storage looks for a
 * photo and for its resized copies (thumb, card, large). It writes through the same R2 binding
 * the app uses (wrangler.jsonc), so there is no bucket name to mistype. Safe to run again: a file
 * that is already there with the same size is skipped.
 */
import fs from "node:fs";
import path from "node:path";

import { getPlatformProxy } from "wrangler";

const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif" };

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  console.error("usage: node scripts/upload-media-to-r2.mjs <media-dir>   (set CLOUDFLARE_ENV=remote for the real bucket)");
  process.exit(1);
}

const environment = process.env.CLOUDFLARE_ENV || undefined;
const proxy = await getPlatformProxy({ environment, remoteBindings: Boolean(environment) });
const bucket = proxy.env.R2;
const where = environment ? `the REAL bucket (wrangler environment "${environment}")` : "the local emulation (.wrangler/state)";

let uploaded = 0;
let skipped = 0;
const failed = [];
try {
  if (!bucket) throw new Error("wrangler.jsonc has no R2 binding for this environment");
  const names = fs.readdirSync(dir).filter((name) => fs.statSync(path.join(dir, name)).isFile() && !name.startsWith("."));
  console.log(`Copying ${names.length} file(s) from ${dir} to ${where}...`);
  for (const name of names) {
    try {
      const data = fs.readFileSync(path.join(dir, name));
      const existing = await bucket.head(name);
      if (existing && existing.size === data.byteLength) {
        skipped++;
        continue;
      }
      const contentType = TYPES[path.extname(name).toLowerCase()] ?? "application/octet-stream";
      await bucket.put(name, data, { httpMetadata: { contentType } });
      uploaded++;
    } catch (e) {
      failed.push(name);
      console.error(`FAILED: ${name}: ${e instanceof Error ? e.message : e}`);
    }
  }
} finally {
  await proxy.dispose();
}

console.log(`${uploaded} uploaded, ${skipped} already there, ${failed.length} failed.`);
process.exit(failed.length ? 1 : 0);

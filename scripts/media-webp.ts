/**
 * Make WebP copies of every photo's resized sizes (thumb 320, card 720, large 1440) and point the
 * photo's sizes at them (D69). The original file is never touched or renamed, and nothing is
 * deleted: the old JPEG/PNG sizes stay in storage, unused.
 *
 * Dry run by default (lists what it would make). WRITE=1 makes the files and updates the rows.
 *
 *   npx payload run scripts/media-webp.ts                    # this Mac's SQLite and .data/media
 *   WRITE=1 npx payload run scripts/media-webp.ts
 *
 * For the live store (Cloudflare D1 + R2; needs `wrangler login`), the owner runs:
 *
 *   DEPLOY_TARGET=cloudflare CLOUDFLARE_ENV=remote NODE_ENV=production npx payload run scripts/media-webp.ts
 *   WRITE=1 DEPLOY_TARGET=cloudflare CLOUDFLARE_ENV=remote NODE_ENV=production npx payload run scripts/media-webp.ts
 *
 * Needed because a Worker can't run sharp (D51): photos uploaded in /admin on Cloudflare keep only
 * their original. Run it again after uploading new photos. Safe to re-run: sizes already WebP are skipped.
 */
import fs from "node:fs/promises";
import path from "node:path";

import config from "@payload-config";
import { getPayload } from "payload";
import sharp from "sharp";

import { IMAGE_SIZES, WEBP_QUALITY } from "../collections/Media";
import { fileUrl, plannedSizes, sizeFilename, type MediaLike } from "../src/lib/media-webp";

type Storage = { read(key: string): Promise<Buffer | null>; write(key: string, data: Buffer): Promise<void> };

const write = process.env.WRITE === "1";
const payload = await getPayload({ config });

async function storage(): Promise<Storage> {
  if (process.env.DEPLOY_TARGET === "cloudflare") {
    const { mediaBucket } = await import("../src/platform/cloudflare");
    const bucket = await mediaBucket();
    return {
      async read(key) {
        const obj = await bucket.get(key);
        return obj?.body ? Buffer.from(await new Response(obj.body as ReadableStream).arrayBuffer()) : null;
      },
      async write(key, data) {
        await bucket.put(key, data, { httpMetadata: { contentType: "image/webp" } });
      },
    };
  }
  const upload = payload.collections.media.config.upload;
  const dir = path.resolve(typeof upload === "object" && upload.staticDir ? upload.staticDir : ".data/media");
  return {
    read: (key) => fs.readFile(path.join(dir, key)).catch(() => null),
    write: (key, data) => fs.writeFile(path.join(dir, key), data),
  };
}

/** The R2 plugin keeps a directly uploaded file under its `_objectKey` folder; sizes sit beside it. */
const keyFor = (doc: { _objectKey?: string | null }, filename: string) => {
  const folder = (doc._objectKey ?? "").replace(/^\/+|\/+$/g, "");
  return folder ? `${folder}/${filename}` : filename;
};

const store = await storage();
const { docs } = await payload.find({ collection: "media", limit: 2000, depth: 0, pagination: false, overrideAccess: true });
let made = 0;
let before = 0;
let after = 0;
let missing = 0;

for (const doc of docs as (MediaLike & { _objectKey?: string | null })[]) {
  // A photo uploaded without sharp may lack its dimensions: read them from the file.
  const needsSize = Boolean(doc.filename && /^image\//.test(doc.mimeType ?? "") && (!doc.width || !doc.height));
  let original = needsSize ? await store.read(keyFor(doc, doc.filename!)) : null;
  if (needsSize && original) {
    const meta = await sharp(original).metadata();
    doc.width = meta.autoOrient?.width ?? meta.width;
    doc.height = meta.autoOrient?.height ?? meta.height;
  }
  const plan = plannedSizes(doc, IMAGE_SIZES);
  if (!plan.length) continue;
  original ??= await store.read(keyFor(doc, doc.filename!));
  if (!original) {
    missing++;
    console.warn(`[media-webp] #${doc.id} ${doc.filename}: original not found in storage, skipped`);
    continue;
  }
  const sizes: Record<string, unknown> = {};
  for (const s of plan) {
    const data = await sharp(original).rotate().resize({ width: s.width, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
    const filename = sizeFilename(doc.filename!, data.info.width, data.info.height);
    const old = doc.sizes?.[s.name] as { filesize?: number | null } | undefined;
    before += old?.filesize ?? 0;
    after += data.data.length;
    console.log(`[media-webp] #${doc.id} ${s.name}: ${filename} ${Math.round(data.data.length / 1024)} KB${old?.filesize ? ` (was ${Math.round(old.filesize / 1024)} KB)` : " (new size)"}`);
    if (write) await store.write(keyFor(doc, filename), data.data);
    sizes[s.name] = { filename, url: fileUrl(filename), width: data.info.width, height: data.info.height, mimeType: "image/webp", filesize: data.data.length };
    made++;
  }
  // Straight to the database: an update through Payload would re-run the upload pipeline and rename the original.
  if (write) await payload.db.updateOne({ collection: "media", id: doc.id, data: { sizes: { ...(doc.sizes ?? {}), ...sizes } } });
}

const kb = (n: number) => `${Math.round(n / 1024)} KB`;
console.log(`[media-webp] ${write ? "made" : "would make"} ${made} WebP sizes; replaced sizes ${kb(before)} → ${kb(after)}${missing ? `; ${missing} originals missing` : ""}.`);
if (!write && made) console.log("[media-webp] dry run: nothing written. Run again with WRITE=1 to apply.");
process.exit(0);

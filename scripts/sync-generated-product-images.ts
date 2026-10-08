/**
 * Add the GPT Image 2 staging photos from the catalog seed to an existing preview database.
 * Safe to re-run: media is matched by sourceFile and image relations are deduplicated.
 */
import fs from "node:fs";
import path from "node:path";

import config from "@payload-config";
import { getPayload } from "payload";

import { isPreviewEnv } from "../src/lib/app-env";

if (!isPreviewEnv()) {
  throw new Error("Refusing to sync generated product images unless APP_ENV is local, staging, or test.");
}

const root = process.cwd();
const assetsDir = path.join(root, "data/assets");
const seed = JSON.parse(fs.readFileSync(path.join(root, "data/catalog/catalog.json"), "utf8")) as {
  media: { file: string; alt: string; credit: string; approvedForLaunch: boolean }[];
  products: { slug: string; images?: string[]; variants?: { key: string; image?: string }[] }[];
};
const generatedMedia = seed.media.filter((media) => media.credit.startsWith("AI-generated with GPT Image 2"));
const generatedFiles = new Set(generatedMedia.map((media) => media.file));
const generatedProducts = seed.products.filter((product) => product.images?.some((file) => generatedFiles.has(file)));
const payload = await getPayload({ config });
const mediaIds = new Map<string, number>();

for (const media of generatedMedia) {
  const found = await payload.find({
    collection: "media",
    where: { sourceFile: { equals: media.file } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (found.docs[0]) {
    mediaIds.set(media.file, found.docs[0].id);
    continue;
  }
  const created = await payload.create({
    collection: "media",
    data: { alt: media.alt, credit: media.credit, approvedForLaunch: false, sourceFile: media.file },
    filePath: path.join(assetsDir, media.file),
    overrideAccess: true,
  });
  mediaIds.set(media.file, created.id);
}

let updated = 0;
let missing = 0;
for (const seedProduct of generatedProducts) {
  const found = await payload.find({
    collection: "products",
    where: { slug: { equals: seedProduct.slug } },
    limit: 1,
    depth: 0,
    draft: true,
    overrideAccess: true,
  });
  const product = found.docs[0];
  if (!product) {
    missing += 1;
    continue;
  }

  const addedImages = (seedProduct.images ?? [])
    .filter((file) => generatedFiles.has(file))
    .map((file) => mediaIds.get(file))
    .filter((id): id is number => id !== undefined);
  const currentImages = (product.images ?? []).map((entry) =>
    typeof entry.image === "object" && entry.image !== null ? entry.image.id : entry.image,
  );
  const imageIds = [...new Set([...addedImages, ...currentImages])];

  const seedVariants = new Map(seedProduct.variants?.filter((variant) => variant.image).map((variant) => [variant.key, variant.image]));
  const variants = (product.variants ?? []).map((variant) => {
    const file = seedVariants.get(variant.key);
    const image = file ? mediaIds.get(file) : undefined;
    return image ? { ...variant, image } : variant;
  });

  await payload.update({
    collection: "products",
    id: product.id,
    data: {
      images: imageIds.map((image) => ({ image })),
      ...(variants.length ? { variants } : {}),
    },
    overrideAccess: true,
  });
  updated += 1;
}

console.log(`Generated staging media: ${generatedMedia.length} created or found`);
console.log(`Products updated: ${updated}; not present in this database: ${missing}`);

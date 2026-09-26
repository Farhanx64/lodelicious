/**
 * Starting catalog from data/catalog/catalog.json. Create-only and idempotent: existing
 * categories, media and products (matched by slug / source file) are left exactly as staff
 * edited them in /admin. Nothing is ever updated or deleted here.
 */
import fs from "node:fs";
import path from "node:path";

import type { Payload } from "payload";

import type { Product } from "@/payload-types";

import { parseCsvRecords } from "../csv";
import type { GiftType, SpecialCode } from "../gifts/types";

export type CatalogSeed = {
  categories: { slug: string; name: string; sortOrder: number; description?: string }[];
  media: { file: string; alt: string; credit: string; approvedForLaunch: boolean }[];
  products: {
    slug: string;
    title: string;
    category: string;
    status?: "published" | "draft";
    brand?: string;
    sizeLabel?: string;
    priceCents?: number;
    priceApproved?: boolean;
    priceSource?: string;
    shortDescription?: string;
    description?: string;
    images?: string[];
    variants?: { key: string; label: string; priceCents?: number; image?: string }[];
    premium?: boolean;
    basketEligible?: boolean;
    giftTypes?: GiftType[];
    exclusiveTo?: SpecialCode;
    perishable?: boolean;
    featured?: boolean;
    allergen?: string;
    sources?: string[];
  }[];
};

export type SeedReport = {
  categories: { created: string[]; existing: string[] };
  media: { created: string[]; existing: string[] };
  products: { created: string[]; existing: string[] };
  presentationImages: string[];
};

type AllergenRow = { product: string; nut_free: string; vegan: string; notes: string; section: string };

export function loadCatalogSeed(root = process.cwd()): { seed: CatalogSeed; allergens: AllergenRow[]; assetsDir: string } {
  const seed = JSON.parse(fs.readFileSync(path.join(root, "data/catalog/catalog.json"), "utf8")) as CatalogSeed;
  const allergens = parseCsvRecords(fs.readFileSync(path.join(root, "data/source/allergen-chart-2026-09-26.csv"), "utf8")) as AllergenRow[];
  return { seed, allergens, assetsDir: path.join(root, "data/assets") };
}

/** Validate references inside the seed before touching the database. */
export function checkSeed(seed: CatalogSeed, allergens: AllergenRow[], assetsDir: string): string[] {
  const problems: string[] = [];
  const categories = new Set(seed.categories.map((c) => c.slug));
  const media = new Set(seed.media.map((m) => m.file));
  const slugs = new Set<string>();
  for (const m of seed.media) if (!fs.existsSync(path.join(assetsDir, m.file))) problems.push(`missing asset ${m.file}`);
  for (const p of seed.products) {
    if (slugs.has(p.slug)) problems.push(`duplicate product slug ${p.slug}`);
    slugs.add(p.slug);
    if (!categories.has(p.category)) problems.push(`${p.slug}: unknown category ${p.category}`);
    for (const img of [...(p.images ?? []), ...(p.variants ?? []).flatMap((v) => (v.image ? [v.image] : []))]) {
      if (!media.has(img)) problems.push(`${p.slug}: image ${img} not in media list`);
    }
    if (p.allergen && !allergens.some((a) => a.product === p.allergen)) problems.push(`${p.slug}: allergen row "${p.allergen}" not found`);
    if (p.priceCents !== undefined && !Number.isSafeInteger(p.priceCents)) problems.push(`${p.slug}: price must be integer cents`);
  }
  return problems;
}

export async function seedCatalog(payload: Payload, seed: CatalogSeed, allergens: AllergenRow[], assetsDir: string): Promise<SeedReport> {
  const problems = checkSeed(seed, allergens, assetsDir);
  if (problems.length) throw new Error(`Catalog seed is invalid:\n- ${problems.join("\n- ")}`);

  const report: SeedReport = {
    categories: { created: [], existing: [] },
    media: { created: [], existing: [] },
    products: { created: [], existing: [] },
    presentationImages: [],
  };

  const categoryIds = new Map<string, number | string>();
  for (const c of seed.categories) {
    const found = await payload.find({ collection: "categories", where: { slug: { equals: c.slug } }, limit: 1, overrideAccess: true });
    if (found.docs[0]) {
      categoryIds.set(c.slug, found.docs[0].id);
      report.categories.existing.push(c.slug);
      continue;
    }
    const created = await payload.create({ collection: "categories", data: { ...c, showInShop: true }, overrideAccess: true });
    categoryIds.set(c.slug, created.id);
    report.categories.created.push(c.slug);
  }

  const mediaIds = new Map<string, number | string>();
  for (const m of seed.media) {
    const found = await payload.find({ collection: "media", where: { sourceFile: { equals: m.file } }, limit: 1, overrideAccess: true });
    if (found.docs[0]) {
      mediaIds.set(m.file, found.docs[0].id);
      report.media.existing.push(m.file);
      continue;
    }
    const created = await payload.create({
      collection: "media",
      data: { alt: m.alt, credit: m.credit, approvedForLaunch: m.approvedForLaunch, sourceFile: m.file },
      filePath: path.join(assetsDir, m.file),
      overrideAccess: true,
    });
    mediaIds.set(m.file, created.id);
    report.media.created.push(m.file);
  }

  const sourceIds = async (refs: string[] = []) => {
    if (!refs.length) return [];
    const found = await payload.find({ collection: "source-records", where: { ref: { in: refs } }, limit: refs.length, depth: 0, overrideAccess: true });
    return found.docs.map((d) => d.id);
  };

  for (const p of seed.products) {
    const found = await payload.find({ collection: "products", where: { slug: { equals: p.slug } }, limit: 1, draft: true, overrideAccess: true });
    if (found.docs[0]) {
      report.products.existing.push(p.slug);
      continue;
    }
    const allergen = p.allergen ? allergens.find((a) => a.product === p.allergen) : undefined;
    const status = p.status ?? "published";
    const data = {
      title: p.title,
      slug: p.slug,
      category: categoryIds.get(p.category)!,
      brand: p.brand,
      sizeLabel: p.sizeLabel,
      shortDescription: p.shortDescription,
      description: p.description,
      images: (p.images ?? []).map((file) => ({ image: mediaIds.get(file)! })),
      featured: p.featured ?? false,
      priceCents: p.priceCents ?? null,
      // Owner product-card prices count as approved; anything else waits for Lody (D22).
      priceApproved: p.priceApproved ?? p.priceCents !== undefined,
      priceSource: p.priceSource,
      channel: "online",
      // Exact counts have not been supplied: unknown stock blocks purchase (PRD INV 05).
      stockState: "unknown",
      variants: (p.variants ?? []).map((v) => ({
        key: v.key,
        label: v.label,
        priceCents: v.priceCents ?? null,
        stockState: "unknown",
        image: v.image ? mediaIds.get(v.image) : undefined,
      })),
      basketEligible: p.basketEligible ?? false,
      giftTypes: p.giftTypes ?? [],
      premium: p.premium ?? false,
      exclusiveTo: p.exclusiveTo,
      nutFree: (allergen?.nut_free as Product["nutFree"]) ?? "unknown",
      vegan: (allergen?.vegan as Product["vegan"]) ?? "unknown",
      allergenNotes: allergen?.notes,
      dietarySource: allergen ? `Owner allergen chart 2026-09-26 (${allergen.section})` : undefined,
      perishable: p.perishable ?? false,
      shippable: false,
      sourceRecords: await sourceIds(p.sources),
      _status: status,
    } as Partial<Product>;
    await payload.create({ collection: "products", data: data as Product, draft: status === "draft", overrideAccess: true });
    report.products.created.push(p.slug);
  }

  // Attach supplied photos to the special presentations, only where staff haven't set one.
  const settings = await payload.findGlobal({ slug: "gift-builder-settings", depth: 0, overrideAccess: true });
  const imageFor: Partial<Record<SpecialCode, string>> = {
    baby_white: "supplied/white-wicker-bassinet.jpg",
    ceramic_bowl: "supplied/baby-ceramic-bowl-pink.jpg",
    ceramic_shoes: "supplied/baby-ceramic-shoes-pink.jpg",
    ceramic_block: "supplied/baby-ceramic-block-pink.jpg",
  };
  let changed = false;
  const specialPresentations = (settings.specialPresentations ?? []).map((p) => {
    const file = imageFor[p.code as SpecialCode];
    if (!file || p.image) return p;
    changed = true;
    report.presentationImages.push(p.code);
    return { ...p, image: mediaIds.get(file) as number };
  });
  if (changed) {
    await payload.updateGlobal({ slug: "gift-builder-settings", data: { specialPresentations }, overrideAccess: true });
  }

  return report;
}

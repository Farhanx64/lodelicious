import "server-only";

import config from "@payload-config";
import { getPayload, type Where } from "payload";

import type { Category, Product } from "@/payload-types";

/**
 * Storefront reads. All run with access control ON (overrideAccess: false) as an anonymous
 * visitor, so drafts and anything else staff haven't published can never leak onto the site.
 */
const PUBLIC = { overrideAccess: false } as const;

const visible: Where = {
  and: [{ _status: { equals: "published" } }, { channel: { not_equals: "hidden" } }],
};

export async function listCategories(): Promise<Category[]> {
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: "categories",
    where: { showInShop: { equals: true } },
    sort: "sortOrder",
    limit: 100,
    depth: 1,
    ...PUBLIC,
  });
  return docs;
}

export async function listProducts(opts: { q?: string; category?: string; featured?: boolean; limit?: number } = {}): Promise<Product[]> {
  const payload = await getPayload({ config });
  const and: Where[] = [visible];
  if (opts.q?.trim()) {
    const q = opts.q.trim().slice(0, 80);
    and.push({ or: [{ title: { like: q } }, { brand: { like: q } }, { shortDescription: { like: q } }] });
  }
  if (opts.category) and.push({ "category.slug": { equals: opts.category } });
  if (opts.featured) and.push({ featured: { equals: true } });
  const { docs } = await payload.find({
    collection: "products",
    where: { and },
    sort: "title",
    limit: opts.limit ?? 200,
    depth: 2,
    ...PUBLIC,
  });
  return docs;
}

export async function getProduct(slug: string): Promise<Product | null> {
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: "products",
    where: { and: [visible, { slug: { equals: slug } }] },
    limit: 1,
    depth: 2,
    ...PUBLIC,
  });
  return docs[0] ?? null;
}

import "server-only";

import config from "@payload-config";
import { getPayload, type Where } from "payload";

import type { Category, Product } from "@/payload-types";

import { applyInventoryView } from "../inventory/view";

/**
 * Storefront reads. Products and categories are staff-only over the REST API (A04, D42), so the
 * storefront reads with override and states what a visitor may see in an explicit `where`:
 * published, and not in the hidden channel. Every product read here must include `visible`.
 */
const PUBLIC = { overrideAccess: true } as const;

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
  return (await applyInventoryView(payload, docs)).products;
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
  return docs[0] ? (await applyInventoryView(payload, [docs[0]])).products[0] : null;
}

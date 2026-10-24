/**
 * Loads what `viewProduct` needs (settings, active holds, components) and applies it to the
 * products a storefront or checkout read has just fetched (INV 04, INV 05, D40).
 */
import type { Payload } from "payload";

import type { InventorySetting, Product } from "@/payload-types";

import { iso, query } from "./db";
import { viewProduct } from "./sellable";
import { DEFAULT_HOLD_MINUTES } from "./types";
import { bomOf } from "./units";

export type InventoryConfig = { holdMinutes: number; maxAgeMs: number | null };

export function configFrom(settings: Partial<InventorySetting> | null | undefined): InventoryConfig {
  const hold = settings?.holdMinutes;
  const age = settings?.maxStockAgeHours;
  return {
    holdMinutes: typeof hold === "number" && hold >= 1 ? hold : DEFAULT_HOLD_MINUTES,
    maxAgeMs: typeof age === "number" && age >= 1 ? age * 3600_000 : null,
  };
}

export async function loadInventoryConfig(payload: Payload): Promise<InventoryConfig> {
  const settings = (await payload.findGlobal({ slug: "inventory-settings", depth: 0, overrideAccess: true })) as Partial<InventorySetting>;
  return configFrom(settings);
}

/** Units held by active, unexpired holds, optionally leaving out one owner's own. */
export async function activeHolds(payload: Payload, now: Date, exceptOwner?: string | null): Promise<Map<string, number>> {
  const rows = await query(
    payload,
    `SELECT product_id AS pid, variant_key AS vk, SUM(quantity) AS q FROM stock_holds
     WHERE status = 'active' AND expires_at > :now AND owner <> :owner GROUP BY product_id, variant_key`,
    { now: iso(now), owner: exceptOwner ?? "" },
  );
  return new Map(rows.map((r) => [r.vk ? `${r.pid}:${r.vk}` : String(r.pid), Number(r.q)]));
}

export type ViewOptions = { now?: Date; exceptOwner?: string | null; config?: InventoryConfig };

/**
 * Copies of `products` as the shop should see them now: stock minus other customers' holds,
 * stale stock unknown, and a curated basket with a bill of materials as many as its components
 * allow. `staleUnits` lists units hidden only because their count is too old.
 */
export async function applyInventoryView(payload: Payload, products: readonly Product[], opts: ViewOptions = {}): Promise<{ products: Product[]; staleUnits: Set<string> }> {
  if (products.length === 0) return { products: [], staleUnits: new Set() };
  const now = opts.now ?? new Date();
  const config = opts.config ?? (await loadInventoryConfig(payload));
  const holds = await activeHolds(payload, now, opts.exceptOwner);

  const byId = new Map(products.map((p) => [String(p.id), p]));
  const missing = [...new Set(products.flatMap((p) => bomOf(p).map((c) => c.productId)))].filter((id) => !byId.has(id));
  if (missing.length > 0) {
    // Components are stock items whether or not they are published, so read their live rows.
    const { docs } = await payload.find({ collection: "products", where: { id: { in: missing } }, limit: missing.length, depth: 0, overrideAccess: true });
    for (const doc of docs as Product[]) byId.set(String(doc.id), doc);
  }

  const staleUnits = new Set<string>();
  const out = products.map((product) => {
    const view = viewProduct(product, { now, maxAgeMs: config.maxAgeMs, holds, productById: (id) => byId.get(id) });
    for (const unit of view.staleUnits) staleUnits.add(unit);
    return view.product;
  });
  return { products: out, staleUnits };
}

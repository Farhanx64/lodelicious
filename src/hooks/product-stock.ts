import { APIError, type CollectionAfterReadHook, type CollectionBeforeChangeHook, type CollectionBeforeOperationHook } from "payload";

import { readLiveStock, type LiveStock } from "../lib/inventory/ledger";
import { bomOf } from "../lib/inventory/units";

/**
 * Stock lives on the product row the storefront reads, but Payload builds every update from the
 * latest saved *version* of a product (a draft, or the snapshot taken at the last publish). So a
 * price-only save, publishing an older draft, or restoring a version would write that version's
 * stock over the sales made since (D40). Two hooks close this:
 *
 * - `pinLiveStock` puts the current stock of the live row back into every update, whatever the
 *   incoming data says, unless trusted server code (no signed-in user, not a version restore)
 *   explicitly passed those stock values (seeding, tests). By the time `beforeChange` runs,
 *   Payload has already filled missing fields from the stale latest version, so
 *   `noteExplicitStock` records what the caller really sent, before that happens.
 * - `showLiveStock` shows staff the live numbers when they open a product, so the read-only
 *   fields are never a stale draft's.
 */

type StockFields = { stockState?: string | null; stockQuantity?: number | null; stockCountedAt?: string | null };
type VariantRow = StockFields & { key?: string | null };

const FIELDS = ["stockState", "stockQuantity", "stockCountedAt"] as const;

const liveFields = (s: { stockState: string; stockQuantity: number | null; stockCountedAt: string | null }): Required<StockFields> => ({
  stockState: s.stockState,
  stockQuantity: s.stockQuantity,
  stockCountedAt: s.stockCountedAt,
});

const UNCOUNTED: Required<StockFields> = { stockState: "unknown", stockQuantity: null, stockCountedAt: null };

type Explicit = { top: Set<string>; variants: Map<string, Set<string>> | null };

const explicitOf = (req: { context?: unknown }): Explicit => ((req.context as { explicitStock?: Explicit } | undefined)?.explicitStock ?? { top: new Set(), variants: null });

/** Runs first: remembers which stock fields the caller itself put in an update. */
export const noteExplicitStock: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  if (operation !== "update") return args;
  const data = ((args as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown> & { variants?: VariantRow[] };
  const top = new Set(FIELDS.filter((f) => data[f] !== undefined));
  const variants = Array.isArray(data.variants)
    ? new Map(data.variants.map((row) => [String(row.key), new Set(FIELDS.filter((f) => row[f] !== undefined))]))
    : null;
  (req.context as Record<string, unknown>).explicitStock = { top, variants } satisfies Explicit;
  return args;
};

/** `keep` says which stock fields of which option the caller really sent; others come from the live row. */
function pinVariants(rows: VariantRow[], live: LiveStock | null, keep: Map<string, Set<string>> | null): VariantRow[] {
  return rows.map((row) => {
    const current = row.key ? live?.variants.get(row.key) : undefined;
    // A new option has no live stock, so it starts uncounted whoever added it.
    const pinned = current ? liveFields(current) : UNCOUNTED;
    const kept = keep?.get(String(row.key));
    const out: VariantRow = { ...row };
    for (const f of FIELDS) if (!kept?.has(f)) (out as Record<string, unknown>)[f] = pinned[f];
    return out;
  });
}

export const pinLiveStock: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const restoring = Boolean((req.context as { isRestoringVersion?: boolean } | undefined)?.isRestoringVersion);
  const trusted = !req.user && !restoring;

  if (operation === "create") {
    // A product made in the admin starts uncounted; counts are recorded under Stock adjustments.
    if (!trusted) {
      Object.assign(data, UNCOUNTED);
      if (Array.isArray(data.variants)) data.variants = pinVariants(data.variants, null, null);
    }
    return data;
  }

  const id = originalDoc?.id ?? data.id;
  const live = id === undefined || id === null ? null : await readLiveStock(req.payload, id);
  if (!live) return data;

  const current = liveFields(live);
  const explicit = trusted ? explicitOf(req) : { top: new Set<string>(), variants: null };
  for (const f of FIELDS) {
    if (!explicit.top.has(f)) data[f] = current[f];
  }
  // When the caller sent no options, the stored ones would come back from the (stale) latest version.
  const rows: VariantRow[] | undefined = Array.isArray(data.variants) ? data.variants : (originalDoc?.variants as VariantRow[] | undefined);
  if (rows) data.variants = pinVariants(rows, live, explicit.variants);
  return data;
};

export const showLiveStock: CollectionAfterReadHook = async ({ doc, req, findMany }) => {
  if (findMany || !req.user || doc?.id === undefined || doc?.id === null) return doc;
  const live = await readLiveStock(req.payload, doc.id);
  if (!live) return doc;
  Object.assign(doc, liveFields(live));
  if (Array.isArray(doc.variants)) {
    doc.variants = doc.variants.map((v: VariantRow) => {
      const current = v.key ? live.variants.get(v.key) : undefined;
      return current ? { ...v, ...liveFields(current) } : v;
    });
  }
  return doc;
};

function fail(message: string): never {
  throw new APIError(message, 400, undefined, true);
}

/** A basket's bill of materials must point at real, separately tracked products (INV 01). */
export const checkComponents: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const published = data._status === "published";
  const parts = bomOf(data);
  if (!published || parts.length === 0) return data;

  if (Array.isArray(data.variants) && data.variants.length > 0) fail("A product with basket contents can't also have options. Remove the options or the contents.");

  const seen = new Set<string>();
  for (const part of parts) {
    const key = `${part.productId}:${part.variantKey ?? ""}`;
    if (seen.has(key)) fail("A component is listed twice. Combine them into one line with the total quantity.");
    seen.add(key);
    if (originalDoc?.id !== undefined && String(originalDoc.id) === part.productId) fail("A basket can't contain itself.");
    const component = await req.payload.findByID({ collection: "products", id: part.productId, depth: 0, overrideAccess: true }).catch(() => null);
    if (!component) fail("A component product no longer exists.");
    if (bomOf(component).length > 0) fail(`${component!.title} is itself a basket with contents. List its parts instead; baskets can't be nested.`);
    const options = component!.variants ?? [];
    if (options.length > 0 && !options.some((v) => v.key === part.variantKey)) fail(`${component!.title} has options: choose which one goes in the basket.`);
    if (options.length === 0 && part.variantKey) fail(`${component!.title} has no options, so leave the option empty.`);
  }
  return data;
};

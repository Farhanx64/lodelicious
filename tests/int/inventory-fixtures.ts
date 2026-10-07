/**
 * Small, fast fixtures for the inventory integration tests: a handful of products with exact
 * stock, three staff accounts and a checkout context, without seeding the whole catalog.
 */
import type { Payload } from "payload";

import type { Category, Product, User } from "@/payload-types";
import { changeBag, loadCheckoutContext, newCartToken, type CheckoutContext } from "@/src/lib/checkout/service";

import { getTestPayload } from "./payload-instance";

// Monday 2026-10-05, 10:00 in Plymouth; the first open pickup is Tuesday 11:00.
export const NOW = new Date("2026-10-05T14:00:00Z");
export const CONTACT = { name: "Pat Customer", email: "pat@example.test", phone: "(508) 555-0100" };
export const FORM = { ...CONTACT, pickup: "2026-10-06|11:00" };

export type World = {
  payload: Payload;
  owner: User;
  manager: User;
  fulfillment: User;
  category: Category;
  ctx: CheckoutContext;
};

let counter = 0;

export async function setupWorld(): Promise<World> {
  const payload = await getTestPayload();
  const make = (email: string, roles: User["roles"]) => payload.create({ collection: "users", data: { email, password: "test-password-123", roles }, overrideAccess: true });
  const owner = await make("lody@example.test", ["owner"]);
  const manager = await make("faisal@example.test", ["manager"]);
  const fulfillment = await make("staff@example.test", ["fulfillment"]);
  const category = await payload.create({ collection: "categories", data: { name: "Sweets", slug: "sweets" } as never, overrideAccess: true });
  const taxClass = await payload.create({ collection: "tax-classes", data: { name: "Sales tax 6.25%", rateBasisPoints: 625, approved: true }, overrideAccess: true });
  await payload.updateGlobal({ slug: "checkout-settings", data: { defaultTaxClass: taxClass.id, packagingTaxClass: taxClass.id }, overrideAccess: true });
  const ctx = await loadCheckoutContext(payload, { APP_ENV: "test" });
  return { payload, owner, manager, fulfillment, category: category as Category, ctx };
}

export type ProductSpec = {
  title?: string;
  /** Counted stock; null leaves it uncounted. */
  stock?: number | null;
  reserve?: number;
  priceCents?: number;
  countedAt?: string | null;
  perishable?: boolean;
  variants?: { key: string; stock: number | null; countedAt?: string | null }[];
  components?: { product: number; variantKey?: string; quantity: number }[];
  channel?: Product["channel"];
  basketEligible?: boolean;
  sku?: string;
};

/** Creates and publishes a product the way seeding does: a trusted write with explicit stock. */
export async function makeProduct(world: Pick<World, "payload" | "category">, spec: ProductSpec = {}): Promise<Product> {
  const n = ++counter;
  const stock = spec.stock === undefined ? 10 : spec.stock;
  return (await world.payload.create({
    collection: "products",
    data: {
      title: spec.title ?? `Test product ${n}`,
      category: world.category.id,
      channel: spec.channel ?? "online",
      priceCents: spec.priceCents ?? 500,
      priceApproved: true,
      stockState: stock === null ? "unknown" : "known",
      stockQuantity: stock,
      stockCountedAt: spec.countedAt === undefined ? null : spec.countedAt,
      onlineReserve: spec.reserve ?? 1,
      lowStockThreshold: 2,
      perishable: spec.perishable ?? false,
      basketEligible: spec.basketEligible ?? false,
      ...(spec.sku ? { sku: spec.sku } : {}),
      ...(spec.variants
        ? {
            variants: spec.variants.map((v) => ({
              key: v.key,
              label: v.key,
              stockState: v.stock === null ? ("unknown" as const) : ("known" as const),
              stockQuantity: v.stock,
              stockCountedAt: v.countedAt ?? null,
            })),
          }
        : {}),
      ...(spec.components ? { components: spec.components } : {}),
      _status: "published",
    } as never,
    draft: false,
    overrideAccess: true,
  })) as Product;
}

/** Live stock straight from the row the storefront reads. */
export async function liveStock(payload: Payload, productId: number | string, variantKey?: string): Promise<number | null> {
  const doc = (await payload.findByID({ collection: "products", id: productId, depth: 0, overrideAccess: true })) as Product;
  const row = variantKey ? doc.variants?.find((v) => v.key === variantKey) : doc;
  return row?.stockQuantity ?? null;
}

export async function movementsFor(payload: Payload, productId: number | string) {
  return (await payload.find({ collection: "stock-movements", where: { product: { equals: productId } }, sort: "id", limit: 100, depth: 0, overrideAccess: true })).docs;
}

/** A fresh bag holding `quantity` of a unit. */
export async function bagWith(world: Pick<World, "payload" | "ctx">, unitId: string | number, quantity = 1, now: Date = NOW): Promise<string> {
  const token = newCartToken();
  const result = await changeBag(world.payload, token, { unitId: String(unitId), quantity, mode: "add" }, world.ctx, now);
  if (!result.ok) throw new Error(`Could not add ${unitId} to the bag: ${result.error}`);
  return token;
}

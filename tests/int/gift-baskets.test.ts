/**
 * Curated gift baskets (D38): seeded as inquiry-only products with unapproved prices, added to
 * existing databases without touching anything staff edited, and never charged packaging.
 */
import type { Payload } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

import type { Product } from "@/payload-types";
import { loadBuilderCatalogFrom } from "@/src/lib/catalog/builder-catalog";
import { GIFT_BASKET_CATEGORY, groupGiftBaskets } from "@/src/lib/catalog/gift-baskets";
import { productAvailability } from "@/src/lib/catalog/product";
import { loadCatalogSeed, seedCatalog } from "@/src/lib/catalog/seed";
import { changeBag, findByToken, loadCheckoutContext, newCartToken, placeOrder, priceBag, type CheckoutContext } from "@/src/lib/checkout/service";
import { readSourceRows } from "@/src/lib/source-files";
import { importSourceRecords } from "@/src/lib/source-import";

import { getTestPayload } from "./payload-instance";

const { seed, allergens, assetsDir } = loadCatalogSeed();

/** slug → Clover public storefront ref (price) */
const BASKETS = {
  "small-gift-basket": "C17",
  "medium-gift-basket": "C13",
  "large-gift-basket": "C09",
  "extra-large-gift-basket": "C07",
  "large-birthday-basket": "C08",
  "large-savory-basket": "C10",
  "small-sympathy-basket": "C19",
  "medium-sympathy-basket": "C15",
  "large-sympathy-basket": "C12",
} as const;
const SLUGS = Object.keys(BASKETS).sort();
const PRICE_OF_REF = new Map(readSourceRows().map((r) => [r.ref, r.sourcePriceCents]));

// Monday 2026-10-05, 10:00 in Plymouth.
const NOW = new Date("2026-10-05T14:00:00Z");
const CONTACT = { name: "Pat Customer", email: "pat@example.test", phone: "(508) 555-0100" };

let payload: Payload;
let ctx: CheckoutContext;

async function bySlug(slug: string): Promise<Product> {
  const { docs } = await payload.find({ collection: "products", where: { slug: { equals: slug } }, draft: true, overrideAccess: true, depth: 1 });
  return docs[0];
}

beforeAll(async () => {
  payload = await getTestPayload();
  await payload.create({ collection: "users", data: { email: "lody@example.test", password: "test-password-123", roles: ["owner"] }, overrideAccess: true });
  await importSourceRecords(payload, readSourceRows());
});

describe("adding the baskets to a database that already has the catalog", () => {
  it("creates only the new category and the nine baskets, and leaves staff edits alone", async () => {
    // A database seeded before this change: the same catalog without the baskets.
    const before = {
      ...seed,
      categories: seed.categories.filter((c) => c.slug !== GIFT_BASKET_CATEGORY),
      products: seed.products.filter((p) => p.category !== GIFT_BASKET_CATEGORY),
    };
    const first = await seedCatalog(payload, before, allergens, assetsDir);
    expect(first.categories.created).toHaveLength(6);
    expect(first.products.created).toHaveLength(71);

    // Staff edit an existing product and a category in /admin.
    const bar = await bySlug("phillips-milk-chocolate-bar");
    await payload.update({ collection: "products", id: bar.id, data: { priceCents: 450 }, overrideAccess: true });
    const candy = (await payload.find({ collection: "categories", where: { slug: { equals: "candy" } }, overrideAccess: true })).docs[0];
    await payload.update({ collection: "categories", id: candy.id, data: { name: "Sweets" }, overrideAccess: true });

    // `npm run seed:catalog` after the upgrade.
    const upgrade = await seedCatalog(payload, seed, allergens, assetsDir);
    expect(upgrade.categories.created).toEqual([GIFT_BASKET_CATEGORY]);
    expect(upgrade.categories.existing).toHaveLength(6);
    expect([...upgrade.products.created].sort()).toEqual(SLUGS);
    expect(upgrade.products.existing).toHaveLength(71);
    expect(upgrade.media.created).toEqual([]);
    expect((await bySlug("phillips-milk-chocolate-bar")).priceCents).toBe(450);
    expect((await payload.findByID({ collection: "categories", id: candy.id, overrideAccess: true })).name).toBe("Sweets");

    // And a further run creates nothing.
    const again = await seedCatalog(payload, seed, allergens, assetsDir);
    expect(again.categories.created).toEqual([]);
    expect(again.products.created).toEqual([]);
    expect(again.media.created).toEqual([]);
    expect((await payload.count({ collection: "products", overrideAccess: true })).totalDocs).toBe(seed.products.length);
  });
});

describe("the seeded curated baskets (D38)", () => {
  it("are inquiry-only, with the observed price unapproved and every unknown left unknown", async () => {
    for (const slug of SLUGS) {
      const ref = BASKETS[slug as keyof typeof BASKETS];
      const p = await bySlug(slug);
      expect(p, slug).toMatchObject({
        _status: "published",
        channel: "inquiry_only",
        priceCents: PRICE_OF_REF.get(ref),
        priceApproved: false,
        stockState: "unknown",
        basketEligible: false,
        premium: false,
        nutFree: "unknown",
        vegan: "unknown",
        images: [],
        shippable: false,
      });
      expect(p.priceSource, slug).toContain(`2026-09-22 (${ref})`);
      expect(p.allergenNotes ?? null, slug).toBeNull();
      expect(p.dietarySource ?? null, slug).toBeNull();
      expect((p.sourceRecords as { ref: string }[]).map((r) => r.ref), slug).toEqual([ref]);
      expect((p.category as { slug: string }).slug).toBe(GIFT_BASKET_CATEGORY);
      expect(productAvailability(p), slug).toEqual({ status: "inquiry_only", purchasable: false, label: "Available by inquiry" });
    }
  });

  it("show up in the shop category for customers, in the page's groups", async () => {
    const category = (await payload.find({ collection: "categories", where: { slug: { equals: GIFT_BASKET_CATEGORY } }, overrideAccess: true })).docs[0];
    expect(category).toMatchObject({ name: "Gift baskets", showInShop: true });
    // Same query as the storefront: anonymous access, published and not hidden.
    const visible = await payload.find({
      collection: "products",
      where: { and: [{ _status: { equals: "published" } }, { channel: { not_equals: "hidden" } }, { "category.slug": { equals: GIFT_BASKET_CATEGORY } }] },
      sort: "title",
      limit: 200,
      depth: 2,
      overrideAccess: false,
    });
    expect(visible.docs.map((d) => d.slug).sort()).toEqual(SLUGS);
    const groups = groupGiftBaskets(visible.docs);
    expect(groups.map((g) => g.key)).toEqual(["everyday", "birthday", "savory", "sympathy"]);
    expect(groups.flatMap((g) => g.products)).toHaveLength(9);
  });

  it("can't be put in the bag as seeded", async () => {
    ctx = await loadCheckoutContext(payload, { APP_ENV: "test" });
    const basket = await bySlug("large-gift-basket");
    expect(await changeBag(payload, newCartToken(), { unitId: String(basket.id), quantity: 1, mode: "add" }, ctx)).toMatchObject({ ok: false });
  });
});

describe("no packaging charge on a curated basket (AC 03)", () => {
  it("charges exactly the basket price plus tax once staff approve the price, count stock and sell it online", async () => {
    const basket = await bySlug("large-gift-basket");
    // What staff would do in /admin once Lody has confirmed the price and stock.
    await payload.update({ collection: "products", id: basket.id, data: { channel: "online", priceApproved: true, stockState: "known", stockQuantity: 6 }, overrideAccess: true });

    const token = newCartToken();
    expect(await changeBag(payload, token, { unitId: String(basket.id), quantity: 2, mode: "add" }, ctx)).toEqual({ ok: true });
    const bag = await priceBag(payload, token, ctx);
    expect(bag.lines).toHaveLength(1);
    // 2 × $139.95; tax 6.25% of $279.90 = $17.49 (rounded half-up). No packaging anywhere.
    expect(bag).toMatchObject({ subtotalCents: 27990, taxCents: 1749, totalCents: 29739, blocking: false });

    const placed = await placeOrder(payload, { cartToken: token, form: { ...CONTACT, pickup: "2026-10-06|11:00" }, now: NOW }, ctx);
    if (!placed.ok) throw new Error(placed.error);
    const order = await findByToken(payload, "orders", placed.number, placed.token);
    expect(order).toMatchObject({ totals: { subtotalCents: 27990, taxCents: 1749, totalCents: 29739 } });
    expect(order!.lines).toHaveLength(1);
    expect(JSON.stringify(order)).not.toMatch(/packag/i);
  });

  it("never turns up as an item inside a custom basket, which would add the builder's packaging fee on top", async () => {
    const catalog = await loadBuilderCatalogFrom(payload);
    const ids = new Set(
      (await payload.find({ collection: "products", where: { "category.slug": { equals: GIFT_BASKET_CATEGORY } }, draft: true, limit: 50, depth: 0, overrideAccess: true })).docs.map((d) => String(d.id)),
    );
    expect(ids.size).toBe(9);
    expect(catalog.products.filter((p) => ids.has(p.id.split(":")[0]))).toEqual([]);
  });
});

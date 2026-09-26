/**
 * The seeded catalog and the admin-editable product rules against a real Payload instance.
 */
import type { Payload } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

import type { Product, User } from "@/payload-types";
import { productAvailability } from "@/src/lib/catalog/product";
import { checkSeed, loadCatalogSeed, seedCatalog } from "@/src/lib/catalog/seed";
import { importSourceRecords } from "@/src/lib/source-import";
import { readSourceRows } from "@/src/lib/source-files";

import { getTestPayload } from "./payload-instance";

const FORBIDDEN = /not allowed to perform this action/i;
const { seed, allergens, assetsDir } = loadCatalogSeed();

let payload: Payload;
let manager: User;
let fulfillment: User;

async function bySlug(slug: string): Promise<Product> {
  const { docs } = await payload.find({ collection: "products", where: { slug: { equals: slug } }, draft: true, overrideAccess: true, depth: 1 });
  return docs[0];
}

beforeAll(async () => {
  payload = await getTestPayload();
  const make = (email: string, roles: User["roles"]) =>
    payload.create({ collection: "users", data: { email, password: "test-password-123", roles }, overrideAccess: true });
  await make("lody@example.test", ["owner"]);
  manager = await make("faisal@example.test", ["manager"]);
  fulfillment = await make("staff@example.test", ["fulfillment"]);
  await importSourceRecords(payload, readSourceRows());
});

describe("catalog seed", () => {
  it("references only real assets, categories and allergen rows", () => {
    expect(checkSeed(seed, allergens, assetsDir)).toEqual([]);
  });

  it("creates the catalog once and then leaves it alone", async () => {
    const first = await seedCatalog(payload, seed, allergens, assetsDir);
    expect(first.products.created).toHaveLength(seed.products.length);
    expect(first.media.created).toHaveLength(seed.media.length);
    expect(first.presentationImages.sort()).toEqual(["baby_white", "ceramic_block", "ceramic_bowl", "ceramic_shoes"]);

    const second = await seedCatalog(payload, seed, allergens, assetsDir);
    expect(second.products.created).toEqual([]);
    expect(second.media.created).toEqual([]);
    expect(second.presentationImages).toEqual([]);
  });

  it("uses the owner card prices and allergen chart verbatim", async () => {
    const bar = await bySlug("phillips-dark-chocolate-bar");
    expect(bar).toMatchObject({ priceCents: 425, priceApproved: true, premium: true, nutFree: "not_guaranteed", vegan: "no" });
    expect(bar.allergenNotes).toBe("Contains milk/butterfat and soy; shared equipment with peanuts/tree nuts and other allergens.");
    expect((bar.sourceRecords as { ref: string }[]).map((r) => r.ref).sort()).toEqual(["D09", "K01", "P03", "P13"]);

    // No allergen data supplied → stays unknown, never inferred from the name.
    expect(await bySlug("milk-chocolate-covered-raisins")).toMatchObject({ nutFree: "unknown", vegan: "unknown", priceCents: 995 });
  });

  it("keeps everything unpurchasable until stock is counted", async () => {
    for (const slug of ["phillips-smores-bar", "teddy-bear", "baby-ceramic-shoes"]) {
      expect(productAvailability(await bySlug(slug))).toMatchObject({ purchasable: false, label: "Currently unavailable" });
    }
  });

  it("models the ceramics as pink/blue options with the assumed, unapproved prices", async () => {
    const shoes = await bySlug("baby-ceramic-shoes");
    expect(shoes).toMatchObject({ priceCents: 1995, priceApproved: false });
    expect(shoes.variants?.map((v) => v.key)).toEqual(["pink", "blue"]);
    expect((await bySlug("baby-ceramic-bowl")).priceCents).toBe(1495);
  });

  it("keeps unpriced Cape Cod fudge as drafts, invisible to customers", async () => {
    const fudge = await bySlug("cape-cod-pistachio-fudge");
    expect(fudge._status).toBe("draft");
    const publicView = await payload.find({ collection: "products", where: { slug: { equals: "cape-cod-pistachio-fudge" } }, overrideAccess: false });
    expect(publicView.docs).toEqual([]);
  });
});

describe("editing products in /admin", () => {
  it("lets a manager change a price, audited, and a re-seed never reverts it", async () => {
    const bar = await bySlug("phillips-milk-chocolate-bar");
    await payload.update({ collection: "products", id: bar.id, data: { priceCents: 450 }, user: manager, overrideAccess: false });

    const audit = await payload.find({
      collection: "audit-log",
      where: { and: [{ target: { equals: "products" } }, { targetId: { equals: String(bar.id) } }, { action: { equals: "update" } }] },
      overrideAccess: true,
    });
    expect(audit.docs.flatMap((d) => d.changes as { field: string; before: unknown; after: unknown }[])).toContainEqual({
      field: "priceCents",
      before: 425,
      after: 450,
    });

    await seedCatalog(payload, seed, allergens, assetsDir);
    expect((await bySlug("phillips-milk-chocolate-bar")).priceCents).toBe(450);
  });

  it("lets a manager add and delete a product", async () => {
    const category = (await payload.find({ collection: "categories", where: { slug: { equals: "candy" } }, overrideAccess: true })).docs[0];
    const created = await payload.create({
      collection: "products",
      data: { title: "Fixture Candy Test", category: category.id, channel: "online", stockState: "unknown", nutFree: "unknown", vegan: "unknown" },
      user: manager,
      overrideAccess: false,
    });
    expect(created.slug).toBe("fixture-candy-test");
    await payload.delete({ collection: "products", id: created.id, user: manager, overrideAccess: false });
    expect((await payload.find({ collection: "products", where: { id: { equals: created.id } }, draft: true, overrideAccess: true })).docs).toEqual([]);
  });

  it("does not let fulfillment staff change products or categories", async () => {
    const bar = await bySlug("phillips-dark-chocolate-bar");
    await expect(
      payload.update({ collection: "products", id: bar.id, data: { priceCents: 1 }, user: fulfillment, overrideAccess: false }),
    ).rejects.toThrow(FORBIDDEN);
    await expect(
      payload.create({ collection: "categories", data: { name: "Nope" }, user: fulfillment, overrideAccess: false }),
    ).rejects.toThrow(FORBIDDEN);
  });

  it("rejects fractional cents", async () => {
    const bar = await bySlug("phillips-dark-chocolate-bar");
    const error = await payload
      .update({ collection: "products", id: bar.id, data: { priceCents: 4.25 }, user: manager, overrideAccess: false })
      .then(() => null, (e: { message: string; data?: { errors?: { message: string }[] } }) => e);
    expect(error?.message).toMatch(/field is invalid: Price/);
    // The admin shows this message next to the field.
    expect(error?.data?.errors?.map((e) => e.message)).toContain("Enter whole cents (1295 for $12.95)");
  });
});

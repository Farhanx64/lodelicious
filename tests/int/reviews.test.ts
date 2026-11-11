/**
 * The Reviews collection against a real Payload instance (D52): the public can read reviews but
 * cannot add, change or remove them; staff can. The home page lists them featured first.
 */
import type { Payload } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

import type { User } from "@/payload-types";
import { loadGoogleReviews, seedGoogleReviews } from "@/src/lib/reviews/seed";
import { listReviews } from "@/src/lib/reviews/service";

import { getTestPayload } from "./payload-instance";

const FORBIDDEN = /not allowed to perform this action/i;

let payload: Payload;
let owner: User;
let fulfillment: User;
let firstId: number;

beforeAll(async () => {
  payload = await getTestPayload();
  const make = (email: string, roles: User["roles"]) =>
    payload.create({ collection: "users", data: { email, password: "test-password-123", roles }, overrideAccess: true });
  owner = await make("lody@example.test", ["owner"]);
  fulfillment = await make("staff@example.test", ["fulfillment"]);
});

describe("reviews access", () => {
  it("starts empty, so the home page has nothing to show", async () => {
    expect(await listReviews(payload)).toEqual([]);
  });

  it("lets staff add reviews", async () => {
    const asOwner = { overrideAccess: false, user: owner } as const;
    const first = await payload.create({ collection: "reviews", data: { name: "Maria", rating: 5, text: "Best fudge around.", date: "2026-09-01T12:00:00.000Z" }, ...asOwner });
    firstId = first.id;
    await payload.create({ collection: "reviews", data: { name: "Tom", rating: 4, text: "Lovely baskets.", date: "2026-10-01T12:00:00.000Z" }, ...asOwner });
    await payload.create({ collection: "reviews", data: { name: "Ana", rating: 5, text: "So kind.", date: "2026-01-01T12:00:00.000Z", featured: true }, overrideAccess: false, user: fulfillment });
  });

  it("lets the public read them: featured first, then newest", async () => {
    const reviews = await listReviews(payload);
    expect(reviews.map((r) => r.name)).toEqual(["Ana", "Tom", "Maria"]);
    expect(reviews[2]).toEqual({ id: String(firstId), name: "Maria", rating: 5, text: "Best fudge around.", date: "2026-09-01" });
  });

  it("refuses the public adding, changing or removing a review", async () => {
    await expect(payload.create({ collection: "reviews", data: { name: "Bot", rating: 5, text: "Buy now" }, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.update({ collection: "reviews", id: firstId, data: { text: "Changed" }, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.delete({ collection: "reviews", id: firstId, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    const kept = await payload.findByID({ collection: "reviews", id: firstId, overrideAccess: true });
    expect(kept.text).toBe("Best fudge around.");
  });

  it("only accepts whole-number ratings from 1 to 5", async () => {
    for (const rating of [0, 6, 4.5]) {
      await expect(payload.create({ collection: "reviews", data: { name: "X", rating, text: "Text" }, overrideAccess: false, user: owner })).rejects.toThrow();
    }
  });

  it("lets staff change and remove reviews", async () => {
    await payload.update({ collection: "reviews", id: firstId, data: { featured: true }, overrideAccess: false, user: owner });
    expect((await listReviews(payload))[0].name).toBe("Maria");
    await payload.delete({ collection: "reviews", id: firstId, overrideAccess: false, user: owner });
    expect((await listReviews(payload)).map((r) => r.name)).not.toContain("Maria");
  });
});

describe("starting Google reviews", () => {
  it("are loaded only into an empty collection, in the file's order, and never again", async () => {
    // The access tests above left reviews behind: the seed must leave them alone.
    expect(await seedGoogleReviews(payload, loadGoogleReviews())).toEqual({ created: 0, skipped: "not-empty" });
    for (const r of (await payload.find({ collection: "reviews", limit: 100, overrideAccess: true })).docs) {
      await payload.delete({ collection: "reviews", id: r.id, overrideAccess: true });
    }
    const products = (await payload.count({ collection: "products", overrideAccess: true })).totalDocs;
    const file = loadGoogleReviews();
    expect(await seedGoogleReviews(payload, file)).toEqual({ created: 7, skipped: null });
    expect((await listReviews(payload)).map((r) => r.name)).toEqual(file.map((r) => r.name));
    expect(await seedGoogleReviews(payload, file)).toEqual({ created: 0, skipped: "not-empty" });
    expect((await payload.count({ collection: "reviews", overrideAccess: true })).totalDocs).toBe(7);
    expect((await payload.count({ collection: "products", overrideAccess: true })).totalDocs).toBe(products);
  });
});

describe("Store details: Google reviews", () => {
  it("defaults to the listing's rating, count and Maps link", async () => {
    const store = await payload.findGlobal({ slug: "store-settings", overrideAccess: false });
    expect(store).toMatchObject({ googleRating: "5.0", googleReviewCount: 34, googleReviewUrl: "https://www.google.com/maps?cid=6229617616978653533" });
  });

  it("refuses a rating Google could not show", async () => {
    await expect(payload.updateGlobal({ slug: "store-settings", data: { googleRating: "5.5" }, overrideAccess: true })).rejects.toThrow();
  });

  it("is public and must be an https link", async () => {
    await expect(payload.updateGlobal({ slug: "store-settings", data: { googleReviewUrl: "g.page/r/x" }, overrideAccess: true })).rejects.toThrow();
    await payload.updateGlobal({ slug: "store-settings", data: { googleReviewUrl: "https://g.page/r/CExample/review" }, overrideAccess: true });
    const store = await payload.findGlobal({ slug: "store-settings", overrideAccess: false });
    expect(store.googleReviewUrl).toBe("https://g.page/r/CExample/review");
  });
});

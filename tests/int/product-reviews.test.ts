/**
 * Customer product reviews (D69) against a real Payload instance: every review waits for staff
 * approval, only approved ones are read for the page and its markup, and the public can't use the
 * API to read, add or approve reviews.
 */
import type { Payload } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

import type { User } from "@/payload-types";
import { HONEYPOT_FIELD } from "@/src/lib/inquiries/shared";
import { approvedReviews, reviewJsonLd, submitProductReview } from "@/src/lib/reviews/product-reviews";
import { storeJsonLd } from "@/src/lib/seo";

import { getTestPayload } from "./payload-instance";

const FORBIDDEN = /not allowed to perform this action/i;
const GOOD = { name: "Maria", rating: "5", text: "Lovely fudge, gone in a day.", email: "maria@example.test" };

let payload: Payload;
let owner: User;
let productId: number;

beforeAll(async () => {
  payload = await getTestPayload();
  owner = await payload.create({ collection: "users", data: { email: "lody@example.test", password: "test-password-123", roles: ["owner"] }, overrideAccess: true });
  const category = await payload.create({ collection: "categories", data: { name: "Fudge", slug: "fudge" }, overrideAccess: true });
  const product = await payload.create({ collection: "products", data: { title: "Turtle Fudge", slug: "turtle-fudge", category: category.id, _status: "published" } as never, overrideAccess: true });
  productId = product.id;
});

describe("product reviews", () => {
  it("saves a customer's review as waiting for approval, and shows nothing yet", async () => {
    expect(await submitProductReview(payload, { id: productId }, GOOD)).toEqual({ error: null, sent: true });
    const { docs } = await payload.find({ collection: "product-reviews", overrideAccess: true });
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ status: "pending", name: "Maria", rating: 5, email: "maria@example.test" });
    const { reviews, summary } = await approvedReviews(payload, productId);
    expect(reviews).toEqual([]);
    expect(summary).toBeNull();
    expect(reviewJsonLd(summary, reviews)).toEqual({});
  });

  it("refuses bad input, keeps what was typed, and drops bots silently", async () => {
    const bad = await submitProductReview(payload, { id: productId }, { ...GOOD, rating: "9" });
    expect(bad.error).toMatch(/star rating/);
    expect(bad.values?.text).toBe(GOOD.text);
    expect((await submitProductReview(payload, { id: productId }, { ...GOOD, text: "See https://spam.example" })).error).toMatch(/links/);
    expect((await submitProductReview(payload, null, GOOD)).error).toMatch(/couldn't find/);
    expect(await submitProductReview(payload, { id: productId }, { ...GOOD, [HONEYPOT_FIELD]: "x" })).toEqual({ error: null, sent: true });
    expect((await payload.count({ collection: "product-reviews", overrideAccess: true })).totalDocs).toBe(1);
  });

  it("shows a review, with rating markup, only once staff approve it", async () => {
    const [pending] = (await payload.find({ collection: "product-reviews", overrideAccess: true })).docs;
    const approved = await payload.update({ collection: "product-reviews", id: pending.id, data: { status: "approved" }, overrideAccess: false, user: owner });
    expect(approved.approvedAt).toBeTruthy();
    await submitProductReview(payload, { id: productId }, { ...GOOD, name: "Tom", rating: "4" });
    const { reviews, summary } = await approvedReviews(payload, productId);
    expect(reviews.map((r) => r.name)).toEqual(["Maria"]);
    expect(summary).toEqual({ count: 1, average: 5 });
    const ld = reviewJsonLd(summary, reviews) as { aggregateRating: Record<string, unknown>; review: Record<string, unknown>[] };
    expect(ld.aggregateRating).toMatchObject({ "@type": "AggregateRating", ratingValue: "5.0", reviewCount: 1 });
    expect(ld.review[0]).toMatchObject({ "@type": "Review", author: { "@type": "Person", name: "Maria" }, reviewBody: GOOD.text });
    expect(JSON.stringify(ld)).not.toContain("maria@example.test");

    const rejected = await payload.update({ collection: "product-reviews", id: pending.id, data: { status: "rejected" }, overrideAccess: true });
    expect(rejected.approvedAt).toBeFalsy();
    expect((await approvedReviews(payload, productId)).summary).toBeNull();
  });

  it("keeps the API closed to the public", async () => {
    const [doc] = (await payload.find({ collection: "product-reviews", overrideAccess: true })).docs;
    await expect(payload.find({ collection: "product-reviews", overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.create({ collection: "product-reviews", data: { product: productId, name: "Bot", rating: 5, text: "Great great great" }, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.update({ collection: "product-reviews", id: doc.id, data: { status: "approved" }, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
  });

  it("never puts review markup on the shop itself (self-serving reviews)", () => {
    const store = storeJsonLd({ name: "Lodelicious", street: "24 Manomet Point Rd", locality: "Plymouth, MA 02360", phone: null, email: null, tagline: null, doordashUrl: null, googleReviewUrl: null } as never);
    expect(store).not.toHaveProperty("aggregateRating");
    expect(store).not.toHaveProperty("review");
  });
});

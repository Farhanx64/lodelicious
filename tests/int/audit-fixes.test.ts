/**
 * Security and audit fixes against a real Payload instance on a throwaway database (D41):
 * first-owner guard and script (A03), password policy (A23), Media access and upload limits
 * (A10, A23), API surface (A08), default closed dates from the seed (A07) and the cart purge (A15).
 *
 * The first describe block runs on an empty users table on purpose: the first-account rules only
 * apply before any user exists.
 */
import type { Payload } from "payload";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getTestPayload } from "./payload-instance";

import { MAX_UPLOAD_BYTES } from "@/collections/Media";
import type { Media, User } from "@/payload-types";
import { seedCatalog } from "@/src/lib/catalog/seed";
import { purgeStaleCarts } from "@/src/lib/checkout/purge-carts";
import { createFirstOwner } from "@/src/lib/owner-setup";
import { csrfOrigins } from "@/src/lib/security";

let payload: Payload;

/** A real 1 x 1 PNG, so sharp can resize it. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function failure(promise: Promise<unknown>): Promise<{ message: string; status?: number; fieldMessages: string[] }> {
  try {
    await promise;
  } catch (error) {
    const e = error as { message: string; status?: number; data?: { errors?: { message: string }[] } };
    return { message: e.message, status: e.status, fieldMessages: (e.data?.errors ?? []).map((x) => x.message) };
  }
  throw new Error("expected the call to fail");
}

const userCount = async () => (await payload.count({ collection: "users", overrideAccess: true })).totalDocs;

beforeAll(async () => {
  payload = await getTestPayload();
});
afterAll(() => vi.unstubAllEnvs());

describe("the first account (A03)", () => {
  it("rejects a weak password before anything is created", async () => {
    const problem = await failure(payload.create({ collection: "users", data: { email: "first@example.test", password: "short", roles: ["owner"] }, overrideAccess: true }));
    expect(problem.fieldMessages.join(" ")).toMatch(/at least 12/);
    expect(await userCount()).toBe(0);
  });

  it("with FIRST_OWNER_EMAIL set, refuses any other address for the first account", async () => {
    vi.stubEnv("FIRST_OWNER_EMAIL", "lody@example.test");
    const problem = await failure(
      payload.create({ collection: "users", data: { email: "bot@example.test", password: "a-long-enough-password-1", roles: ["owner"] }, overrideAccess: true }),
    );
    expect(problem.status).toBe(403);
    expect(problem.message).toMatch(/not allowed to create the first account/);
    expect(await userCount()).toBe(0);
  });

  it("the owner script reports each problem and creates nothing", async () => {
    const good = { OWNER_EMAIL: "lody@example.test", OWNER_PASSWORD: "a-long-enough-password-1", FIRST_OWNER_EMAIL: "lody@example.test" };
    const expectRefused = async (env: Parameters<typeof createFirstOwner>[1], pattern: RegExp) => {
      const result = await createFirstOwner(payload, env);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toMatch(pattern);
      expect(await userCount()).toBe(0);
    };
    await expectRefused({}, /OWNER_EMAIL and OWNER_PASSWORD/);
    await expectRefused({ ...good, OWNER_PASSWORD: "" }, /OWNER_EMAIL and OWNER_PASSWORD/);
    await expectRefused({ ...good, OWNER_EMAIL: "not-an-email" }, /not a valid email/);
    await expectRefused({ ...good, OWNER_PASSWORD: "short" }, /not strong enough/);
    await expectRefused({ ...good, OWNER_PASSWORD: "Password123456" }, /too easy to guess/);
    await expectRefused({ ...good, OWNER_EMAIL: "someone-else@example.test" }, /does not match FIRST_OWNER_EMAIL/);
  });

  it("the owner script creates the owner (matching FIRST_OWNER_EMAIL in any case), then refuses to run again", async () => {
    const created = await createFirstOwner(payload, { OWNER_EMAIL: "  Lody@Example.test ", OWNER_PASSWORD: "a-long-enough-password-1", FIRST_OWNER_EMAIL: "LODY@example.test" });
    expect(created).toEqual({ ok: true, email: "Lody@Example.test" });
    const { docs } = await payload.find({ collection: "users", overrideAccess: true });
    expect(docs).toHaveLength(1);
    expect(docs[0].roles).toEqual(["owner"]);
    expect(docs[0]).not.toHaveProperty("password");

    const again = await createFirstOwner(payload, { OWNER_EMAIL: "other@example.test", OWNER_PASSWORD: "a-long-enough-password-1" });
    expect(again.ok).toBe(false);
    expect(!again.ok && again.error).toMatch(/already exists/);
    expect(await userCount()).toBe(1);
  });

  it("after the first account, FIRST_OWNER_EMAIL does not stop the owner adding staff", async () => {
    const owner = (await payload.find({ collection: "users", overrideAccess: true })).docs[0];
    const staff = await payload.create({
      collection: "users",
      data: { email: "staff@example.test", password: "another-long-password-2", roles: ["fulfillment"] },
      user: owner,
      overrideAccess: false,
    });
    expect(staff.roles).toEqual(["fulfillment"]);
  });
});

describe("staff passwords (A23)", () => {
  it("accepts a strong password when changing one, and rejects weak ones", async () => {
    const owner = (await payload.find({ collection: "users", where: { email: { equals: "lody@example.test" } }, overrideAccess: true })).docs[0] as User;
    const staff = (await payload.find({ collection: "users", where: { email: { equals: "staff@example.test" } }, overrideAccess: true })).docs[0] as User;
    for (const weak of ["short", "Abcdef1!ghi", "123456789012", "alllowercase"]) {
      const problem = await failure(payload.update({ collection: "users", id: staff.id, data: { password: weak }, user: owner, overrideAccess: false }));
      expect(problem.fieldMessages.length, weak).toBeGreaterThan(0);
    }
    await expect(payload.update({ collection: "users", id: staff.id, data: { password: "test-password-123" }, user: owner, overrideAccess: false })).resolves.toBeTruthy();
    // Editing something else does not need a password at all.
    await expect(payload.update({ collection: "users", id: staff.id, data: { name: "Sam" }, user: owner, overrideAccess: false })).resolves.toMatchObject({ name: "Sam" });
  });
});

describe("media (A10, A23)", () => {
  let approved: Media;
  let unapproved: Media;
  let staff: User;
  let productSlug: string;

  const upload = (alt: string, approvedForLaunch: boolean, size = PNG.length) =>
    payload.create({
      collection: "media",
      data: { alt, approvedForLaunch },
      file: { data: PNG, mimetype: "image/png", name: `${alt}.png`, size },
      overrideAccess: true,
    });

  beforeAll(async () => {
    staff = (await payload.find({ collection: "users", where: { email: { equals: "staff@example.test" } }, overrideAccess: true })).docs[0] as User;
    approved = await upload("approved-photo", true);
    unapproved = await upload("placeholder-photo", false);
    const category = await payload.create({ collection: "categories", data: { name: "Test shelf", slug: "test-shelf", showInShop: true }, overrideAccess: true });
    const product = await payload.create({
      collection: "products",
      data: {
        title: "Test product",
        slug: "test-product",
        category: category.id,
        priceCents: 500,
        priceApproved: true,
        images: [{ image: unapproved.id }, { image: approved.id }],
        _status: "published",
      } as never,
      overrideAccess: true,
    });
    productSlug = product.slug as string;
  });

  const anonymousIds = async () => (await payload.find({ collection: "media", limit: 50, overrideAccess: false })).docs.map((d) => d.alt).sort();

  it("on the live store anonymous visitors can list and open only photos approved for launch", async () => {
    vi.stubEnv("APP_ENV", "production");
    expect(await anonymousIds()).toEqual(["approved-photo"]);
    await expect(payload.findByID({ collection: "media", id: approved.id, overrideAccess: false })).resolves.toMatchObject({ alt: "approved-photo" });
    await failure(payload.findByID({ collection: "media", id: unapproved.id, overrideAccess: false }));
  });

  it("an unset or mistyped APP_ENV is the live store too", async () => {
    for (const value of ["", "prod", "live"]) {
      vi.stubEnv("APP_ENV", value);
      expect(await anonymousIds(), JSON.stringify(value)).toEqual(["approved-photo"]);
    }
  });

  it("staff of every role still see every photo on the live store", async () => {
    vi.stubEnv("APP_ENV", "production");
    const owner = (await payload.find({ collection: "users", where: { email: { equals: "lody@example.test" } }, overrideAccess: true })).docs[0] as User;
    for (const user of [owner, staff]) {
      const found = await payload.find({ collection: "media", limit: 50, user, overrideAccess: false });
      expect(found.docs.map((d) => d.alt).sort()).toEqual(["approved-photo", "placeholder-photo"]);
    }
  });

  it("staging, local and test are unchanged: everything is readable", async () => {
    for (const value of ["staging", "local", "test"]) {
      vi.stubEnv("APP_ENV", value);
      expect(await anonymousIds(), value).toEqual(["approved-photo", "placeholder-photo"]);
    }
  });

  it("the storefront still gets approved photos on a product, and an unapproved one comes back unpopulated (Photo coming soon)", async () => {
    vi.stubEnv("APP_ENV", "production");
    const { docs } = await payload.find({ collection: "products", where: { slug: { equals: productSlug } }, depth: 1, overrideAccess: false });
    const images = (docs[0].images ?? []).map((i) => i.image);
    expect(images[0]).toBe(unapproved.id); // just the id: ProductImage shows "Photo coming soon"
    expect(images[1]).toMatchObject({ id: approved.id, alt: "approved-photo" });
  });

  it("refuses a file over 15 MB before it is processed, and says so plainly", async () => {
    expect(MAX_UPLOAD_BYTES).toBe(15 * 1024 * 1024);
    const problem = await failure(upload("too-big", true, MAX_UPLOAD_BYTES + 1));
    expect(problem.status).toBe(413);
    expect(problem.message).toMatch(/under 15 MB/);
    // Exactly at the limit is let through to normal processing.
    await expect(upload("at-the-limit", true, MAX_UPLOAD_BYTES)).resolves.toMatchObject({ alt: "at-the-limit" });
  });

  it("caps the pixels sharp will decode", () => {
    expect(payload.collections.media.config.upload.constructorOptions?.limitInputPixels).toBe(64_000_000);
  });
});

describe("API surface (A08)", () => {
  it("has GraphQL switched off", () => {
    expect(payload.config.graphQL.disable).toBe(true);
  });

  it("takes its CSRF allowlist from NEXT_PUBLIC_SITE_URL, and the login cookie is not Secure only because this is a test", () => {
    expect(payload.config.csrf).toEqual(csrfOrigins(process.env));
    expect(payload.collections.users.config.auth.cookies.secure).toBe(false);
  });
});

describe("default closed dates in the seed (A07)", () => {
  const empty = { categories: [], media: [], products: [] };
  const now = new Date("2026-10-06T12:00:00Z");
  const expected = ["2026-12-25", "2027-01-01", "2027-09-06", "2027-12-25", "2028-01-01"];

  it("fills an empty list once, with the labels", async () => {
    const before = await payload.findGlobal({ slug: "checkout-settings", depth: 0, overrideAccess: true });
    expect(before.closedDates ?? []).toEqual([]);
    const first = await seedCatalog(payload, empty, [], "", { now });
    expect(first.closedDates).toEqual(expected);
    const after = await payload.findGlobal({ slug: "checkout-settings", depth: 0, overrideAccess: true });
    expect(after.closedDates?.map((d) => [d.date, d.label])).toEqual([
      ["2026-12-25", "Christmas Day"],
      ["2027-01-01", "New Year's Day"],
      ["2027-09-06", "Labor Day"],
      ["2027-12-25", "Christmas Day"],
      ["2028-01-01", "New Year's Day"],
    ]);
  });

  it("never touches a list staff have entered", async () => {
    await payload.updateGlobal({ slug: "checkout-settings", data: { closedDates: [{ date: "2026-11-26", label: "Thanksgiving" }] }, overrideAccess: true });
    const again = await seedCatalog(payload, empty, [], "", { now });
    expect(again.closedDates).toEqual([]);
    const after = await payload.findGlobal({ slug: "checkout-settings", depth: 0, overrideAccess: true });
    expect(after.closedDates?.map((d) => d.date)).toEqual(["2026-11-26"]);
  });
});

describe("abandoned shopping bags (A15)", () => {
  const bag = (n: number) =>
    payload.create({ collection: "carts", data: { tokenHash: `${n}`.padStart(64, "0"), lines: [{ unitId: "1", quantity: 1 }] }, overrideAccess: true });
  const bagCount = async () => (await payload.count({ collection: "carts", overrideAccess: true })).totalDocs;
  const pause = () => new Promise((resolve) => setTimeout(resolve, 30));

  it("deletes only bags last touched before the cutoff", async () => {
    await bag(1);
    await pause();
    const cutoff = new Date();
    await pause();
    await bag(2);
    expect(await bagCount()).toBe(2);

    expect(await purgeStaleCarts(payload, new Date(0))).toBe(0);
    expect(await bagCount()).toBe(2);

    expect(await purgeStaleCarts(payload, cutoff)).toBe(1);
    const left = await payload.find({ collection: "carts", overrideAccess: true });
    expect(left.docs.map((d) => d.tokenHash)).toEqual([`${2}`.padStart(64, "0")]);

    expect(await purgeStaleCarts(payload, new Date(Date.now() + 60_000))).toBe(1);
    expect(await bagCount()).toBe(0);
  });
});

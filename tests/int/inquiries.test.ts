/**
 * Inquiries and chocolate-fountain terms against a real Payload instance (D37): created only by
 * the service, in staff review, with a server-computed estimate; closed to the public; readable
 * by every staff role.
 */
import type { Payload } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

import type { Inquiry, User } from "@/payload-types";
import { loadCatalogSeed, seedCatalog } from "@/src/lib/catalog/seed";
import { HONEYPOT_FIELD } from "@/src/lib/inquiries/shared";
import { findPublishedItem, inquiryFormState, loadEventOffer, submitInquiry } from "@/src/lib/inquiries/service";
import { readSourceRows } from "@/src/lib/source-files";
import { importSourceRecords } from "@/src/lib/source-import";

import { getTestPayload } from "./payload-instance";

const FORBIDDEN = /not allowed to perform this action/i;
// 22:00 on Monday 2026-10-05 in Plymouth (already the 6th in UTC).
const NOW = new Date("2026-10-06T02:00:00Z");
const CONTACT = { name: "Pat Customer", email: "pat@example.test", phone: "(508) 555-0100" };
const GENERAL = { ...CONTACT, topic: "general", message: "Do you have gluten-free fudge?" };
const FOUNTAIN = { ...CONTACT, eventDate: "2026-12-12", setupTime: "14:30", location: "Plymouth Yacht Club", guests: "50", message: "Chocolate and strawberries please" };

let payload: Payload;
let owner: User;
let manager: User;
let fulfillment: User;

const all = async () => (await payload.find({ collection: "inquiries", limit: 100, sort: "sequence", overrideAccess: true })).docs;
const count = async () => (await payload.count({ collection: "inquiries", overrideAccess: true })).totalDocs;

async function created(result: Awaited<ReturnType<typeof submitInquiry>>): Promise<Inquiry> {
  if (!result.ok || !result.number) throw new Error(result.ok ? "dropped" : result.error);
  return (await payload.find({ collection: "inquiries", where: { number: { equals: result.number } }, limit: 1, depth: 1, overrideAccess: true })).docs[0];
}

beforeAll(async () => {
  payload = await getTestPayload();
  const make = (email: string, roles: User["roles"]) =>
    payload.create({ collection: "users", data: { email, password: "test-password-123", roles }, overrideAccess: true });
  owner = await make("lody@example.test", ["owner"]);
  manager = await make("faisal@example.test", ["manager"]);
  fulfillment = await make("staff@example.test", ["fulfillment"]);
  await importSourceRecords(payload, readSourceRows());
  const { seed, allergens, assetsDir } = loadCatalogSeed();
  await seedCatalog(payload, seed, allergens, assetsDir);
});

describe("general inquiries", () => {
  it("are created in staff review (status new) with a readable number and the customer's words", async () => {
    const result = await submitInquiry(payload, { kind: "contact", form: GENERAL, now: NOW });
    expect(result).toEqual({ ok: true, number: "INQ-1001" });
    const inquiry = await created(result);
    expect(inquiry).toMatchObject({
      status: "new",
      topic: "general",
      customer: CONTACT,
      message: "Do you have gluten-free fudge?",
      product: null,
      itemTitle: null,
      estimateCents: null,
    });
  });

  it("link a published product and snapshot its title from the database, not the browser", async () => {
    const result = await submitInquiry(payload, { kind: "contact", form: { ...GENERAL, topic: "baby_white", item: "baby-ceramic-bowl", itemTitle: "A title the browser invented" }, now: NOW });
    const inquiry = await created(result);
    expect(inquiry.topic).toBe("baby_white");
    expect(inquiry.itemTitle).toBe("Baby Ceramic Bowl");
    expect(typeof inquiry.product === "object" && inquiry.product?.slug).toBe("baby-ceramic-bowl");
  });

  it("ignore unknown, malformed, draft and hidden items, but still take the inquiry", async () => {
    const hidden = (await payload.find({ collection: "products", where: { slug: { equals: "toblerone" } }, overrideAccess: true, depth: 0 })).docs[0];
    await payload.update({ collection: "products", id: hidden.id, data: { channel: "hidden" }, overrideAccess: true });

    for (const [i, item] of ["no-such-product", "../../etc/passwd", "cape-cod-penuche-fudge", "toblerone"].entries()) {
      expect(await findPublishedItem(payload, item)).toBeNull();
      const inquiry = await created(await submitInquiry(payload, { kind: "contact", form: { ...GENERAL, message: `Question ${i}`, item }, now: NOW }));
      expect(inquiry).toMatchObject({ status: "new", product: null, itemTitle: null });
    }
    expect(await findPublishedItem(payload, "baby-ceramic-bowl")).toMatchObject({ title: "Baby Ceramic Bowl", categorySlug: "baby-gifts" });
  });

  it("drop honeypot submissions silently: success to the bot, nothing stored", async () => {
    const before = await count();
    const result = await submitInquiry(payload, { kind: "contact", form: { ...GENERAL, [HONEYPOT_FIELD]: "http://spam.example" }, now: NOW });
    expect(result).toEqual({ ok: true, number: null });
    const fountain = await submitInquiry(payload, { kind: "fountain", form: { ...FOUNTAIN, [HONEYPOT_FIELD]: "x" }, now: NOW });
    expect(fountain).toEqual({ ok: true, number: null });
    expect(await count()).toBe(before);
  });

  it("refuse invalid input without storing anything", async () => {
    const before = await count();
    expect(await submitInquiry(payload, { kind: "contact", form: { ...GENERAL, email: "nope" }, now: NOW })).toMatchObject({ ok: false });
    expect(await submitInquiry(payload, { kind: "contact", form: { ...GENERAL, topic: "refund" }, now: NOW })).toMatchObject({ ok: false });
    // The general form can't be used to skip the fountain estimate.
    expect(await submitInquiry(payload, { kind: "contact", form: { ...GENERAL, topic: "fountain" }, now: NOW })).toMatchObject({ ok: false });
    expect(await count()).toBe(before);
  });

  it("treat a double submit as one inquiry, even when both arrive at once", async () => {
    const form = { ...GENERAL, message: "Double click test" };
    const [a, b] = await Promise.all([submitInquiry(payload, { kind: "contact", form, now: NOW }), submitInquiry(payload, { kind: "contact", form, now: NOW })]);
    expect(a).toEqual(b);
    expect((await payload.count({ collection: "inquiries", where: { message: { equals: "Double click test" } }, overrideAccess: true })).totalDocs).toBe(1);
  });

  it("keep numbers unique after the owner deletes one in the middle", async () => {
    const [first, second] = await all();
    expect(first.number).toBe("INQ-1001");
    await payload.delete({ collection: "inquiries", id: second.id, user: owner, overrideAccess: false });
    const next = await created(await submitInquiry(payload, { kind: "contact", form: { ...GENERAL, message: "After a deletion" }, now: NOW }));
    const numbers = (await all()).map((i) => i.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers).toContain(next.number);
  });
});

describe("chocolate fountain inquiries", () => {
  it("start from the confirmed offer when the settings have never been saved", async () => {
    const offer = await loadEventOffer(payload);
    expect(offer).toMatchObject({ enabled: true, terms: { baseCents: 25000, includedHours: 2, perGuestCents: 850, chocolatePerGuestCents: 500, fruitPerGuestCents: 350, depositPercentBasisPoints: 2500 } });
    expect(offer.open).toEqual({ cancellation: null, serviceArea: null, minimumGuests: null, extensions: null });
  });

  it("store the event, a server-computed estimate and the terms used, with nothing booked or charged", async () => {
    const inquiry = await created(await submitInquiry(payload, { kind: "fountain", form: FOUNTAIN, now: NOW }));
    expect(inquiry).toMatchObject({
      status: "new",
      topic: "fountain",
      event: { date: "2026-12-12", setupTime: "14:30", guests: 50, location: "Plymouth Yacht Club" },
      estimateCents: 67500, // $250.00 + 50 x $8.50
      estimateTerms: {
        baseCents: 25000,
        includedHours: 2,
        perGuestCents: 850,
        chocolatePerGuestCents: 500,
        fruitPerGuestCents: 350,
        depositPercentBasisPoints: 2500,
        guests: 50,
        guestsCents: 42500,
        totalCents: 67500,
      },
    });
    expect(Object.keys(inquiry)).not.toContain("payment");
  });

  it("never trust an estimate or a topic sent by the browser", async () => {
    const inquiry = await created(
      await submitInquiry(payload, { kind: "fountain", form: { ...FOUNTAIN, guests: "10", message: "Tampered", estimateCents: "1", totalCents: "1", topic: "general" }, now: NOW }),
    );
    expect(inquiry).toMatchObject({ topic: "fountain", estimateCents: 25000 + 10 * 850 });
  });

  it("refuse past dates and bad guest counts", async () => {
    const before = await count();
    expect(await submitInquiry(payload, { kind: "fountain", form: { ...FOUNTAIN, eventDate: "2026-10-04" }, now: NOW })).toMatchObject({ ok: false, error: expect.stringMatching(/past/) });
    expect(await submitInquiry(payload, { kind: "fountain", form: { ...FOUNTAIN, guests: "1001" }, now: NOW })).toMatchObject({ ok: false });
    expect(await submitInquiry(payload, { kind: "fountain", form: { ...FOUNTAIN, guests: "0" }, now: NOW })).toMatchObject({ ok: false });
    // Still the same evening in Plymouth, though already tomorrow in UTC.
    expect(await submitInquiry(payload, { kind: "fountain", form: { ...FOUNTAIN, eventDate: "2026-10-05", message: "Tonight" }, now: NOW })).toMatchObject({ ok: true });
    expect(await count()).toBe(before + 1);
  });

  it("recompute from the stored settings when the manager changes the price, and stop when disabled", async () => {
    await payload.updateGlobal({ slug: "event-settings", data: { perGuestCents: 900, chocolatePerGuestCents: 600, fruitPerGuestCents: 300 }, user: manager, overrideAccess: false });
    const repriced = await created(await submitInquiry(payload, { kind: "fountain", form: { ...FOUNTAIN, message: "After the price change" }, now: NOW }));
    expect(repriced.estimateCents).toBe(25000 + 50 * 900);
    expect(repriced.estimateTerms).toMatchObject({ perGuestCents: 900, chocolatePerGuestCents: 600 });

    await payload.updateGlobal({ slug: "event-settings", data: { enabled: false }, user: manager, overrideAccess: false });
    expect((await loadEventOffer(payload)).enabled).toBe(false);
    const before = await count();
    expect(await submitInquiry(payload, { kind: "fountain", form: { ...FOUNTAIN, message: "While disabled" }, now: NOW })).toMatchObject({ ok: false, error: expect.stringMatching(/contact us/) });
    expect(await count()).toBe(before);
    await payload.updateGlobal({ slug: "event-settings", data: { enabled: true, perGuestCents: 850, chocolatePerGuestCents: 500, fruitPerGuestCents: 350 }, user: manager, overrideAccess: false });
  });
});

describe("event-settings", () => {
  it("is readable by the storefront without logging in", async () => {
    const doc = await payload.findGlobal({ slug: "event-settings", overrideAccess: false });
    expect(doc.baseCents).toBe(25000);
  });

  it("can be changed by owner and manager but not fulfillment, and every change is audited", async () => {
    await expect(payload.updateGlobal({ slug: "event-settings", data: { baseCents: 1 }, user: fulfillment, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.updateGlobal({ slug: "event-settings", data: { baseCents: 1 }, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await payload.updateGlobal({ slug: "event-settings", data: { serviceArea: "Plymouth County" }, user: owner, overrideAccess: false });
    expect((await loadEventOffer(payload)).open.serviceArea).toBe("Plymouth County");
    await payload.updateGlobal({ slug: "event-settings", data: { serviceArea: "" }, user: owner, overrideAccess: false });

    const audit = await payload.find({ collection: "audit-log", where: { target: { equals: "event-settings" } }, overrideAccess: true });
    expect(audit.docs.flatMap((d) => d.changes as { field: string }[]).map((c) => c.field)).toEqual(expect.arrayContaining(["perGuestCents", "enabled", "serviceArea"]));
  });

  it("rejects fractional cents, out-of-range values and a breakdown that doesn't add up", async () => {
    const update = (data: Record<string, unknown>) => payload.updateGlobal({ slug: "event-settings", data: data as never, user: owner, overrideAccess: false });
    await expect(update({ baseCents: 250.5 })).rejects.toThrow();
    await expect(update({ baseCents: -1 })).rejects.toThrow();
    await expect(update({ includedHours: 0 })).rejects.toThrow();
    await expect(update({ depositPercentBasisPoints: 10001 })).rejects.toThrow();
    await expect(update({ minimumGuests: 5000 })).rejects.toThrow();
    await expect(update({ perGuestCents: 1000 })).rejects.toThrow(); // chocolate 500 + fruit 350 != 1000
    expect((await loadEventOffer(payload)).terms).toMatchObject({ baseCents: 25000, includedHours: 2, perGuestCents: 850, depositPercentBasisPoints: 2500 });
  });
});

describe("who can see and change inquiries (OPS 01, least privilege)", () => {
  it("is closed to the public: no reading, creating, changing or deleting", async () => {
    const [any] = await all();
    await expect(payload.find({ collection: "inquiries", overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.findByID({ collection: "inquiries", id: any.id, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(
      payload.create({ collection: "inquiries", data: { number: "INQ-9", sequence: 9, idempotencyKey: "x", topic: "general", status: "new", customer: CONTACT, message: "hi" }, overrideAccess: false }),
    ).rejects.toThrow(FORBIDDEN);
    await expect(payload.update({ collection: "inquiries", id: any.id, data: { status: "closed" }, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.delete({ collection: "inquiries", id: any.id, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
  });

  it("lets every staff role read, but nobody create through the API, not even the owner", async () => {
    for (const user of [owner, manager, fulfillment]) {
      expect((await payload.find({ collection: "inquiries", user, overrideAccess: false })).totalDocs).toBeGreaterThan(0);
      await expect(
        payload.create({ collection: "inquiries", data: { number: "INQ-9", sequence: 9, idempotencyKey: "y", topic: "general", status: "new", customer: CONTACT, message: "hi" }, user, overrideAccess: false }),
      ).rejects.toThrow(FORBIDDEN);
    }
  });

  it("lets fulfillment move an inquiry along and keep notes, but not rewrite what the customer sent", async () => {
    const target = await created(await submitInquiry(payload, { kind: "fountain", form: { ...FOUNTAIN, message: "Staff edit test" }, now: NOW }));
    const updated = await payload.update({
      collection: "inquiries",
      id: target.id,
      data: {
        status: "in_review",
        staffNotes: "Called back, checking the date",
        message: "Rewritten",
        topic: "general",
        estimateCents: 1,
        customer: { ...CONTACT, email: "someone-else@example.test" },
        event: { guests: 1 },
      },
      user: fulfillment,
      overrideAccess: false,
    });
    expect(updated).toMatchObject({
      status: "in_review",
      staffNotes: "Called back, checking the date",
      message: "Staff edit test",
      topic: "fountain",
      estimateCents: 67500,
      customer: CONTACT,
      event: { guests: 50 },
    });
  });

  it("audits status changes and notes, without copying customer details into the log", async () => {
    const target = (await all()).find((i) => i.status === "in_review")!;
    const audit = await payload.find({ collection: "audit-log", where: { and: [{ target: { equals: "inquiries" } }, { targetId: { equals: String(target.id) } }] }, overrideAccess: true });
    const changes = audit.docs.flatMap((d) => d.changes as { field: string }[]);
    expect(changes.map((c) => c.field)).toEqual(expect.arrayContaining(["status", "staffNotes"]));
    expect(JSON.stringify(audit.docs)).not.toContain(CONTACT.email);
  });

  it("lets only the owner delete", async () => {
    const [any] = await all();
    await expect(payload.delete({ collection: "inquiries", id: any.id, user: manager, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.delete({ collection: "inquiries", id: any.id, user: fulfillment, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
  });
});

describe("what the form actions hand back", () => {
  it("shows the number on success and nothing else that was stored", async () => {
    const state = await inquiryFormState(payload, "contact", { ...GENERAL, message: "State test" }, NOW);
    expect(state).toEqual({ error: null, sent: true, number: expect.stringMatching(/^INQ-\d+$/) });
  });

  it("looks like success to a bot, without a number", async () => {
    expect(await inquiryFormState(payload, "contact", { ...GENERAL, [HONEYPOT_FIELD]: "spam" }, NOW)).toEqual({ error: null, sent: true, number: null });
  });

  it("returns a friendly error and the visitor's own entries, never the honeypot or unknown fields", async () => {
    const state = await inquiryFormState(payload, "contact", { ...GENERAL, email: "nope", extra: "<script>", [HONEYPOT_FIELD]: "" }, NOW);
    expect(state.error).toMatch(/valid email/);
    expect(state.values).toMatchObject({ name: "Pat Customer", message: "Do you have gluten-free fudge?", topic: "general", email: "nope" });
    expect(Object.keys(state.values!)).not.toContain("extra");
    expect(Object.keys(state.values!)).not.toContain(HONEYPOT_FIELD);
  });
});

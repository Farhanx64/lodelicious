/**
 * Policies global (D39): who may read and change it, that approval needs text, that changes are
 * audited, and that the stored text feeds the resolver the pages use.
 */
import type { Payload } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

import { getTestPayload } from "./payload-instance";

import { Policies } from "@/globals/Policies";
import type { User } from "@/payload-types";
import { POLICIES, resolvePolicy, type ContactFacts } from "@/src/lib/policies";

const FORBIDDEN = /not allowed to perform this action/i;
const contact: ContactFacts = { street: "24 Manomet Point Rd.", locality: "Plymouth, MA 02360", phone: "(774) 283-4676", email: "lodelicious1@gmail.com" };

let payload: Payload;
let owner: User;
let manager: User;
let fulfillment: User;

beforeAll(async () => {
  payload = await getTestPayload();
  const make = (email: string, roles: User["roles"]) =>
    payload.create({ collection: "users", data: { email, password: "test-password-123", roles }, overrideAccess: true });
  owner = await make("lody@example.test", ["owner"]);
  manager = await make("faisal@example.test", ["manager"]);
  fulfillment = await make("staff@example.test", ["fulfillment"]);
});

const update = (user: User | undefined, data: Record<string, unknown>) =>
  payload.updateGlobal({ slug: "policies", data, user, overrideAccess: false });

describe("policies global", () => {
  it("has one explicit group per fixed policy and nothing else", () => {
    // Payload adds createdAt/updatedAt when it sanitizes the config; every other field is a group.
    const groups = Policies.fields.filter((f) => f.type === "group").map((f) => ("name" in f ? f.name : null));
    expect(groups).toEqual(POLICIES.map((p) => p.field));
    expect(Policies.fields.filter((f) => f.type !== "group").map((f) => ("name" in f ? f.name : null))).toEqual(["updatedAt", "createdAt"]);
  });

  it("starts empty and unapproved: no draft text is stored in the database", async () => {
    const doc = await payload.findGlobal({ slug: "policies" });
    for (const p of POLICIES) {
      expect(doc[p.field]?.body ?? null, p.slug).toBeNull();
      expect(doc[p.field]?.approved ?? false, p.slug).toBe(false);
    }
    // And so, with nothing saved, live shows nothing but the being-finalised message.
    expect(resolvePolicy("privacy", doc, { staging: false, contact })!.view).toBe("pending");
  });

  it("cannot be read or changed anonymously", async () => {
    await expect(payload.findGlobal({ slug: "policies", overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(update(undefined, { privacy: { body: "x" } })).rejects.toThrow(FORBIDDEN);
  });

  it("cannot be changed by fulfillment staff", async () => {
    await expect(update(fulfillment, { privacy: { body: "x" } })).rejects.toThrow(FORBIDDEN);
    // Staff can still read it.
    await expect(payload.findGlobal({ slug: "policies", user: fulfillment, overrideAccess: false })).resolves.toBeTruthy();
  });

  it("lets the owner save text and approve it, and the resolver then shows it live", async () => {
    const saved = await update(owner, {
      pickupAndDelivery: { title: "", body: "Our pickup text.\n\nSecond paragraph.", approved: true, lastReviewed: "2026-10-06T12:00:00.000Z" },
    });
    expect(saved.pickupAndDelivery?.approved).toBe(true);

    const doc = await payload.findGlobal({ slug: "policies" });
    const r = resolvePolicy("pickup-and-delivery", doc, { staging: false, contact })!;
    expect(r).toMatchObject({ view: "approved", title: "Pickup and delivery", banner: false });
    expect(r.paragraphs).toEqual(["Our pickup text.", "Second paragraph."]);
    expect(r.lastReviewed).toContain("2026-10-06");
    // Other policies are unaffected.
    expect(resolvePolicy("privacy", doc, { staging: false, contact })!.view).toBe("pending");
  });

  it("lets a manager save unapproved text, which only staging shows", async () => {
    await update(manager, { privacy: { body: "Draft privacy text from Faisal.", approved: false } });
    const doc = await payload.findGlobal({ slug: "policies" });
    expect(resolvePolicy("privacy", doc, { staging: false, contact })!.view).toBe("pending");
    expect(resolvePolicy("privacy", doc, { staging: true, contact })).toMatchObject({ view: "saved", banner: true, paragraphs: ["Draft privacy text from Faisal."] });
  });

  it("refuses to approve a policy that has no text", async () => {
    // Payload names the invalid field; the validation message itself shows beside it in the admin.
    const invalid = /field is invalid: Damaged or missing items > Approved/;
    await expect(update(owner, { damagedOrMissingItems: { body: "   ", approved: true } })).rejects.toThrow(invalid);
    await expect(update(owner, { damagedOrMissingItems: { approved: true } })).rejects.toThrow(invalid);
    const doc = await payload.findGlobal({ slug: "policies" });
    expect(doc.damagedOrMissingItems?.approved ?? false).toBe(false);
  });

  it("audits changes to policy text and approval", async () => {
    await update(owner, { cancellationsAndRefunds: { body: "Refund text.", approved: true } });
    const audit = await payload.find({
      collection: "audit-log",
      where: { and: [{ target: { equals: "policies" } }, { user: { equals: owner.id } }] },
      sort: "-createdAt",
      overrideAccess: true,
    });
    expect(audit.docs.length).toBeGreaterThan(0);
    const fields = audit.docs.flatMap((d) => (d.changes as { field: string }[]).map((c) => c.field));
    expect(fields).toContain("cancellationsAndRefunds");
    expect(fields).toContain("pickupAndDelivery");
  });
});

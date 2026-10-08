/**
 * Policies global (D39): who may read and change it, that only the owner can approve, that an
 * unapproved edit never goes live, that changes are audited, and that the stored text feeds the
 * resolver the pages use.
 */
import type { Payload } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

import { getTestPayload } from "./payload-instance";

import { Policies } from "@/globals/Policies";
import type { User } from "@/payload-types";
import { POLICIES, resolvePolicy, type ContactFacts } from "@/src/lib/policies";

const FORBIDDEN = /not allowed to perform this action/i;
const contact: ContactFacts = { street: "24 Manomet Point Rd.", locality: "Plymouth, MA 02360", phone: "(774) 283-4676", email: "lodelicious1@gmail.com" };
const live = { staging: false, contact };
const staging = { staging: true, contact };

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
const stored = () => payload.findGlobal({ slug: "policies" });

describe("policies global: access", () => {
  it("has one explicit group per fixed policy and nothing else", () => {
    // Payload adds createdAt/updatedAt when it sanitizes the config; every other field is a group.
    const groups = Policies.fields.filter((f) => f.type === "group").map((f) => ("name" in f ? f.name : null));
    expect(groups).toEqual(POLICIES.map((p) => p.field));
    expect(Policies.fields.filter((f) => f.type !== "group").map((f) => ("name" in f ? f.name : null))).toEqual(["updatedAt", "createdAt"]);
  });

  it("starts empty and unapproved: no draft text is stored in the database", async () => {
    const doc = await stored();
    for (const p of POLICIES) {
      expect(doc[p.field]?.body ?? null, p.slug).toBeNull();
      expect(doc[p.field]?.approved ?? false, p.slug).toBe(false);
    }
    // And so, with nothing saved, live shows nothing but the being-finalised message.
    expect(resolvePolicy("privacy", doc, live)!.view).toBe("pending");
  });

  it("cannot be read or changed anonymously", async () => {
    await expect(payload.findGlobal({ slug: "policies", overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(update(undefined, { privacy: { body: "x" } })).rejects.toThrow(FORBIDDEN);
  });

  it("cannot be changed by fulfillment staff, who can still read it", async () => {
    await expect(update(fulfillment, { privacy: { body: "x" } })).rejects.toThrow(FORBIDDEN);
    await expect(payload.findGlobal({ slug: "policies", user: fulfillment, overrideAccess: false })).resolves.toBeTruthy();
  });
});

describe("policies global: saving and approving", () => {
  it("lets the owner save text and approve it, and the resolver then shows it live", async () => {
    const saved = await update(owner, {
      pickupAndDelivery: { title: "", body: "Our pickup text.\n\nSecond paragraph.", approved: true, lastReviewed: "2026-10-06T12:00:00.000Z" },
    });
    expect(saved.pickupAndDelivery?.approved).toBe(true);

    const doc = await stored();
    const r = resolvePolicy("pickup-and-delivery", doc, live)!;
    expect(r).toMatchObject({ view: "approved", title: "Pickup and delivery", banner: false });
    expect(r.paragraphs).toEqual(["Our pickup text.", "Second paragraph."]);
    expect(r.lastReviewed).toContain("2026-10-06");
    // Other policies are unaffected.
    expect(resolvePolicy("privacy", doc, live)!.view).toBe("pending");
  });

  it("lets a manager save unapproved text, which only staging shows", async () => {
    await update(manager, { privacy: { body: "Draft privacy text from Faisal.", approved: false } });
    const doc = await stored();
    expect(resolvePolicy("privacy", doc, live)!.view).toBe("pending");
    expect(resolvePolicy("privacy", doc, staging)).toMatchObject({ view: "saved", banner: true, paragraphs: ["Draft privacy text from Faisal."] });
  });

  it("refuses to approve a policy with no text, whoever asks", async () => {
    await expect(update(owner, { damagedOrMissingItems: { body: "   ", approved: true } })).rejects.toThrow(/Write the policy text before approving it/);
    await expect(update(owner, { damagedOrMissingItems: { approved: true } })).rejects.toThrow(/Write the policy text before approving it/);
    expect((await stored()).damagedOrMissingItems?.approved ?? false).toBe(false);
  });

  it("does not let a manager approve, and nothing of that save is kept", async () => {
    await expect(update(manager, { substitutionsAndDietaryRequests: { body: "Faisal's wording.", approved: true } })).rejects.toThrow(
      /Only the owner can approve a policy/,
    );
    const doc = await stored();
    expect(doc.substitutionsAndDietaryRequests?.approved ?? false).toBe(false);
    expect(doc.substitutionsAndDietaryRequests?.body ?? null).toBeNull();
  });

  it("clears the approval when a manager edits approved text, so the edit never goes live", async () => {
    await update(owner, { substitutionsAndDietaryRequests: { body: "Lody's approved wording.", approved: true } });
    expect(resolvePolicy("substitutions-and-dietary-requests", await stored(), live)!.view).toBe("approved");

    // The admin form sends the whole group, with Approved still ticked.
    const saved = await update(manager, { substitutionsAndDietaryRequests: { body: "Faisal's edit.", approved: true } });
    expect(saved.substitutionsAndDietaryRequests).toMatchObject({ body: "Faisal's edit.", approved: false });
    const doc = await stored();
    expect(resolvePolicy("substitutions-and-dietary-requests", doc, live)!.view).toBe("pending");
    expect(resolvePolicy("substitutions-and-dietary-requests", doc, staging)).toMatchObject({ view: "saved", banner: true });

    // A title-only change counts too.
    await update(owner, { substitutionsAndDietaryRequests: { approved: true } });
    await update(manager, { substitutionsAndDietaryRequests: { title: "Swaps" } });
    expect((await stored()).substitutionsAndDietaryRequests?.approved).toBe(false);
  });

  it("keeps the approval when a manager saves the same text, or the owner edits it", async () => {
    await update(owner, { cancellationsAndRefunds: { body: "Refund text.", approved: true } });
    await update(manager, { cancellationsAndRefunds: { body: "Refund text.", approved: true, lastReviewed: "2026-10-07T12:00:00.000Z" } });
    expect((await stored()).cancellationsAndRefunds?.approved).toBe(true);

    await update(owner, { cancellationsAndRefunds: { body: "Refund text, reworded by Lody.", approved: true } });
    const doc = await stored();
    expect(doc.cancellationsAndRefunds?.approved).toBe(true);
    expect(resolvePolicy("cancellations-and-refunds", doc, live)!.paragraphs).toEqual(["Refund text, reworded by Lody."]);
  });

  it("works on partial saves: the stored text counts when Approved is ticked on its own", async () => {
    await update(manager, { damagedOrMissingItems: { body: "Report problems promptly." } });
    expect((await stored()).damagedOrMissingItems?.approved ?? false).toBe(false);

    await update(owner, { damagedOrMissingItems: { approved: true } });
    expect((await stored()).damagedOrMissingItems?.approved).toBe(true);

    // A body-only save by the owner keeps it; by the manager it clears it.
    await update(owner, { damagedOrMissingItems: { body: "Report problems promptly, please." } });
    expect((await stored()).damagedOrMissingItems?.approved).toBe(true);
    await update(manager, { damagedOrMissingItems: { body: "Report problems promptly, please. Thanks." } });
    expect((await stored()).damagedOrMissingItems?.approved).toBe(false);
  });

  it("lets a manager withdraw an approval", async () => {
    await update(owner, { privacy: { body: "Privacy text.", approved: true } });
    expect(resolvePolicy("privacy", await stored(), live)!.view).toBe("approved");
    await update(manager, { privacy: { approved: false } });
    expect(resolvePolicy("privacy", await stored(), live)!.view).toBe("pending");
  });

  it("audits changes to policy text and approval", async () => {
    const audit = await payload.find({
      collection: "audit-log",
      where: { and: [{ target: { equals: "policies" } }, { user: { equals: owner.id } }] },
      overrideAccess: true,
      limit: 100,
    });
    expect(audit.docs.length).toBeGreaterThan(0);
    const fields = audit.docs.flatMap((d) => (d.changes as { field: string }[]).map((c) => c.field));
    expect(fields).toContain("cancellationsAndRefunds");
    expect(fields).toContain("pickupAndDelivery");
  });
});

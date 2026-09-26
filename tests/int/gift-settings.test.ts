/**
 * Gift-builder rules stored in Payload: defaults, validation on save, access and audit.
 */
import type { Payload } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

import { getTestPayload } from "./payload-instance";

import type { User } from "@/payload-types";
import { DEFAULT_GIFT_SETTINGS } from "@/src/lib/gifts/defaults";
import { getGiftSettings } from "@/src/lib/gifts/load";
import { resolveCountRange } from "@/src/lib/gifts/rules";

const FORBIDDEN = /not allowed to perform this action/i;

let payload: Payload;
let manager: User;
let fulfillment: User;

beforeAll(async () => {
  payload = await getTestPayload();
  const make = (email: string, roles: User["roles"]) =>
    payload.create({ collection: "users", data: { email, password: "test-password-123", roles }, overrideAccess: true });
  await make("lody@example.test", ["owner"]);
  manager = await make("faisal@example.test", ["manager"]);
  fulfillment = await make("staff@example.test", ["fulfillment"]);
});

describe("gift-builder-settings", () => {
  it("starts with the PRD and chart defaults", async () => {
    const settings = await getGiftSettings(payload);
    expect(settings).toEqual(DEFAULT_GIFT_SETTINGS);
    expect(resolveCountRange(settings, "large", "sympathy")).toEqual({ min: 13, max: 16 });
  });

  it("is readable by the storefront without logging in", async () => {
    const doc = await payload.findGlobal({ slug: "gift-builder-settings", overrideAccess: false });
    expect(doc.budgetNotice).toMatch(/covers the gift's contents and its basket and packaging/);
  });

  it("cannot be changed by fulfillment staff", async () => {
    await expect(
      payload.updateGlobal({ slug: "gift-builder-settings", data: { budgetNotice: "x" }, user: fulfillment, overrideAccess: false }),
    ).rejects.toThrow(FORBIDDEN);
  });

  it("lets a manager change a packaging fee, and audits it", async () => {
    const current = await payload.findGlobal({ slug: "gift-builder-settings" });
    const sizes = current.sizes!.map((s) => (s.code === "small" ? { ...s, packagingCents: 2195 } : s));
    await payload.updateGlobal({ slug: "gift-builder-settings", data: { sizes }, user: manager, overrideAccess: false });

    const settings = await getGiftSettings(payload);
    expect(settings.sizes.find((s) => s.code === "small")!.packagingCents).toBe(2195);

    const audit = await payload.find({
      collection: "audit-log",
      where: { target: { equals: "gift-builder-settings" } },
      overrideAccess: true,
    });
    expect(audit.docs).toHaveLength(1);
    expect((audit.docs[0].changes as { field: string }[]).map((c) => c.field)).toEqual(["sizes"]);
  });

  it("rejects a rule set the engine can't use, with a readable message", async () => {
    const current = await payload.findGlobal({ slug: "gift-builder-settings" });
    const bad = current.sizes!.map((s) => (s.code === "large" ? { ...s, minItems: 15 } : s));
    await expect(
      payload.updateGlobal({ slug: "gift-builder-settings", data: { sizes: bad }, user: manager, overrideAccess: false }),
    ).rejects.toThrow(/minimum \(15\) is above maximum \(14\)/);

    const fractional = current.sizes!.map((s) => (s.code === "large" ? { ...s, packagingCents: 29.95 } : s));
    await expect(
      payload.updateGlobal({ slug: "gift-builder-settings", data: { sizes: fractional }, user: manager, overrideAccess: false }),
    ).rejects.toThrow(/whole number/);
  });

  it("refuses to make a special presentation orderable without a price", async () => {
    const current = await payload.findGlobal({ slug: "gift-builder-settings" });
    const specials = current.specialPresentations!.map((p) => (p.code === "cowboy" ? { ...p, status: "available" as const } : p));
    await expect(
      payload.updateGlobal({ slug: "gift-builder-settings", data: { specialPresentations: specials }, user: manager, overrideAccess: false }),
    ).rejects.toThrow(/set a price and premium maximum/);
  });
});

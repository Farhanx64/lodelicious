/**
 * Integration tests against a real Payload instance on a throwaway SQLite database.
 */
import type { Payload } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

import { getTestPayload } from "./payload-instance";

import type { User } from "@/payload-types";
import { importSourceRecords } from "@/src/lib/source-import";
import { readSourceRows } from "@/src/lib/source-files";

// Payload's Forbidden error: proves the rejection is access control, not a validation error.
const FORBIDDEN = /not allowed to perform this action/i;

let payload: Payload;
let owner: User;
let manager: User;
let fulfillment: User;

async function createUser(email: string, roles: User["roles"]): Promise<User> {
  return payload.create({
    collection: "users",
    data: { email, password: "test-password-123", roles },
    overrideAccess: true,
  });
}

beforeAll(async () => {
  payload = await getTestPayload();
  // Submitted as fulfillment on purpose: the first account must still become owner.
  owner = await createUser("lody@example.test", ["fulfillment"]);
  manager = await createUser("faisal@example.test", ["manager"]);
  fulfillment = await createUser("staff@example.test", ["fulfillment"]);
});

describe("users", () => {
  it("makes the first account the owner regardless of submitted roles", () => {
    expect(owner.roles).toEqual(["owner"]);
    expect(manager.roles).toEqual(["manager"]);
  });

  it("does not let a manager or fulfillment user change roles", async () => {
    const updated = await payload.update({
      collection: "users",
      id: fulfillment.id,
      data: { roles: ["owner"] },
      user: fulfillment,
      overrideAccess: false,
    });
    expect(updated.roles).toEqual(["fulfillment"]);

    await expect(
      payload.update({ collection: "users", id: fulfillment.id, data: { roles: ["owner"] }, user: manager, overrideAccess: false }),
    ).rejects.toThrow(FORBIDDEN);
  });

  it("lets only the owner create staff accounts", async () => {
    await expect(
      payload.create({
        collection: "users",
        data: { email: "x@example.test", password: "test-password-123", roles: ["fulfillment"] },
        user: manager,
        overrideAccess: false,
      }),
    ).rejects.toThrow(FORBIDDEN);
  });
});

describe("source records import", () => {
  it("imports all 73 observations as unreviewed, then is idempotent", async () => {
    const rows = readSourceRows();
    const first = await importSourceRecords(payload, rows);
    expect(first.created).toHaveLength(73);
    expect(first.conflicts).toEqual([]);

    const second = await importSourceRecords(payload, rows);
    expect(second.created).toEqual([]);
    expect(second.unchanged).toHaveLength(73);

    const { totalDocs } = await payload.count({ collection: "source-records", where: { disposition: { equals: "unreviewed" } } });
    expect(totalDocs).toBe(73);
  });

  it("reports changed evidence as a conflict instead of overwriting it", async () => {
    const rows = readSourceRows().map((r) => (r.ref === "P15" ? { ...r, sourcePriceCents: 595 } : r));
    const report = await importSourceRecords(payload, rows);
    expect(report.conflicts).toEqual([{ ref: "P15", fields: ["sourcePriceCents"] }]);

    const p15 = await payload.find({ collection: "source-records", where: { ref: { equals: "P15" } } });
    expect(p15.docs[0].sourcePriceCents).toBe(425);
  });
});

describe("source record review", () => {
  async function record(ref: string) {
    const { docs } = await payload.find({ collection: "source-records", where: { ref: { equals: ref } }, overrideAccess: true });
    return docs[0];
  }

  it("lets a manager set a disposition, stamps the reviewer and writes an audit entry", async () => {
    const c05 = await record("C05");
    const updated = await payload.update({
      collection: "source-records",
      id: c05.id,
      data: { disposition: "active", reviewNotes: "Confirmed in store" },
      user: manager,
      overrideAccess: false,
    });
    expect(updated.disposition).toBe("active");
    expect(typeof updated.reviewedBy === "object" ? updated.reviewedBy?.id : updated.reviewedBy).toBe(manager.id);
    expect(updated.reviewedAt).toBeTruthy();

    const audit = await payload.find({
      collection: "audit-log",
      where: { and: [{ target: { equals: "source-records" } }, { targetId: { equals: String(c05.id) } }, { action: { equals: "update" } }] },
      overrideAccess: true,
    });
    expect(audit.docs).toHaveLength(1);
    expect(audit.docs[0].changes).toEqual([
      { field: "disposition", before: "unreviewed", after: "active" },
      { field: "reviewNotes", before: null, after: "Confirmed in store" },
    ]);
    expect(typeof audit.docs[0].user === "object" ? audit.docs[0].user?.id : audit.docs[0].user).toBe(manager.id);
  });

  it("never changes source evidence through the API, even for the owner", async () => {
    const c20 = await record("C20");
    const updated = await payload.update({
      collection: "source-records",
      id: c20.id,
      data: { sourcePriceCents: 1, sourceName: "Renamed" },
      user: owner,
      overrideAccess: false,
    });
    expect(updated.sourcePriceCents).toBe(1095);
    expect(updated.sourceName).toBe("Teddy Bear");
  });

  it("blocks fulfillment staff from reviewing records", async () => {
    const c20 = await record("C20");
    await expect(
      payload.update({ collection: "source-records", id: c20.id, data: { disposition: "active" }, user: fulfillment, overrideAccess: false }),
    ).rejects.toThrow(FORBIDDEN);
  });

  it("blocks creating or deleting records through the API", async () => {
    await expect(
      payload.create({
        collection: "source-records",
        data: { ref: "X01", source: "doordash", sourceName: "Fake", sourcePriceCents: 100, disposition: "active" },
        user: owner,
        overrideAccess: false,
      }),
    ).rejects.toThrow(FORBIDDEN);
    const c20 = await record("C20");
    await expect(payload.delete({ collection: "source-records", id: c20.id, user: owner, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
  });
});

describe("audit log", () => {
  it("cannot be written, edited or deleted through the API", async () => {
    await expect(
      payload.create({
        collection: "audit-log",
        data: { action: "update", target: "x", targetId: "1", changes: [] },
        user: owner,
        overrideAccess: false,
      }),
    ).rejects.toThrow(FORBIDDEN);

    const { docs } = await payload.find({ collection: "audit-log", limit: 1, overrideAccess: true });
    await expect(payload.delete({ collection: "audit-log", id: docs[0].id, user: owner, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
  });

  it("is hidden from fulfillment staff", async () => {
    await expect(payload.find({ collection: "audit-log", user: fulfillment, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
  });
});

describe("store settings", () => {
  it("defaults to the confirmed business details", async () => {
    const store = await payload.findGlobal({ slug: "store-settings" });
    expect(store.name).toBe("Lodelicious Gifts & Sweets");
    expect(store.street).toBe("24 Manomet Point Rd.");
    expect(store.phone).toBe("(774) 283-4676");
    expect(store.email).toBe("lodelicious1@gmail.com");
    expect(store.timezone).toBe("America/New_York");
    expect(store.hours?.map((h) => [h.days, h.time])).toEqual([
      ["Mon–Thu", "11 AM – 6 PM"],
      ["Fri–Sat", "11 AM – 7 PM"],
      ["Sun", "11 AM – 5 PM"],
    ]);
  });

  it("is editable by managers (audited) but not fulfillment staff", async () => {
    await expect(
      payload.updateGlobal({ slug: "store-settings", data: { phone: "(000) 000-0000" }, user: fulfillment, overrideAccess: false }),
    ).rejects.toThrow(FORBIDDEN);

    await payload.updateGlobal({ slug: "store-settings", data: { hoursLabel: "Summer hours" }, user: manager, overrideAccess: false });
    await payload.updateGlobal({ slug: "store-settings", data: { phone: "(774) 283-0000" }, user: manager, overrideAccess: false });
    const audit = await payload.find({
      collection: "audit-log",
      where: { target: { equals: "store-settings" } },
      overrideAccess: true,
    });
    const fields = audit.docs.flatMap((d) => (d.changes as { field: string }[]).map((c) => c.field));
    expect(fields).toContain("phone");
  });
});

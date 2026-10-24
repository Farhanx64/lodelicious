import { describe, expect, it } from "vitest";

import { afterFailure, backoffMs, OUTBOX_MAX_ATTEMPTS } from "./outbox";
import { parsePlan, recordKeyOf, serializePlan } from "./records";
import { checkPerishables, checkRestock } from "./restock";

const label = (l: { productId: string }) => `item ${l.productId}`;
const line = (productId: string, quantity: number, variantKey: string | null = null) => ({ productId, variantKey, quantity });

describe("checkRestock (refunds and restocking are separate decisions)", () => {
  const sold = new Map([["1", 3], ["2:pink", 1]]);

  it("accepts what the record took, and merges repeated lines", () => {
    expect(checkRestock([line("1", 1), line("1", 1)], sold, new Map(), label)).toEqual({ ok: true, lines: [line("1", 2)] });
  });

  it("refuses an empty request, an item the record never took, and more than was taken", () => {
    expect(checkRestock([], sold, new Map(), label)).toMatchObject({ ok: false });
    expect(checkRestock([line("9", 1)], sold, new Map(), label)).toMatchObject({ ok: false, error: expect.stringMatching(/not taken from stock/) });
    expect(checkRestock([line("1", 4)], sold, new Map(), label)).toMatchObject({ ok: false, error: expect.stringMatching(/Only 3/) });
  });

  it("counts what was already put back", () => {
    const back = new Map([["1", 2]]);
    expect(checkRestock([line("1", 1)], sold, back, label)).toMatchObject({ ok: true });
    expect(checkRestock([line("1", 2)], sold, back, label)).toMatchObject({ ok: false, error: expect.stringMatching(/Only 1/) });
    expect(checkRestock([line("1", 1)], sold, new Map([["1", 3]]), label)).toMatchObject({ ok: false, error: expect.stringMatching(/already been put back/) });
  });

  it("tells options apart", () => {
    expect(checkRestock([line("2", 1, "pink")], sold, new Map(), label)).toMatchObject({ ok: true });
    expect(checkRestock([line("2", 1, "blue")], sold, new Map(), label)).toMatchObject({ ok: false });
  });
});

describe("checkPerishables", () => {
  it("passes when nothing is perishable", () => {
    expect(checkPerishables([], false, false)).toEqual({ ok: true });
  });
  it("needs an owner or manager, and their confirmation", () => {
    expect(checkPerishables(["Fresh fruit"], false, true)).toMatchObject({ ok: false, error: expect.stringMatching(/Only the owner or a manager/) });
    expect(checkPerishables(["Fresh fruit"], true, false)).toMatchObject({ ok: false, error: expect.stringMatching(/Tick the confirmation/) });
    expect(checkPerishables(["Fresh fruit"], true, true)).toEqual({ ok: true });
  });
});

describe("outbox retry timing (INV 06)", () => {
  it("backs off 30 s, 1 min, 2 min … and stops growing at 6 hours", () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([30_000, 60_000, 120_000, 240_000]);
    expect(backoffMs(30)).toBe(6 * 3600_000);
  });
  it("retries until the last attempt, then gives up as dead", () => {
    const now = new Date("2026-10-06T12:00:00Z");
    expect(afterFailure(1, now)).toEqual({ status: "failed", nextAttemptAt: "2026-10-06T12:00:30.000Z" });
    expect(afterFailure(OUTBOX_MAX_ATTEMPTS - 1, now).status).toBe("failed");
    expect(afterFailure(OUTBOX_MAX_ATTEMPTS, now)).toEqual({ status: "dead", nextAttemptAt: null });
  });
});

describe("stock plan records", () => {
  it("round-trips a plan and ignores damaged rows", () => {
    const plan = [line("1", 2), line("2", 1, "pink")];
    expect(parsePlan(JSON.parse(JSON.stringify(serializePlan(plan))))).toEqual(plan);
    expect(parsePlan([{ productId: 3, quantity: 0 }, { quantity: 2 }, null, { productId: 4, variantKey: "", quantity: 2 }])).toEqual([line("4", 2)]);
    expect(parsePlan("nope")).toEqual([]);
  });
  it("keys a record by its number and creation time, so a reused number can't collide", () => {
    expect(recordKeyOf({ number: "SP-1005", createdAt: "2026-10-06T12:00:00.000Z" })).not.toBe(recordKeyOf({ number: "SP-1005", createdAt: "2026-10-07T12:00:00.000Z" }));
  });
});

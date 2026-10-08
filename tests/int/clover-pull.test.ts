/**
 * The Clover pull worker against a real Payload instance and the fake adapter (INV 03, INV 05,
 * D43): counts arrive only as `sync` movements, nothing is echoed back, unsent website sales are
 * added to Clover's number, every item read is stamped, matching is by Clover ID only, and an
 * interrupted run resumes from its checkpoint.
 */
import type { Payload } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

import { CloverTransientError } from "@/src/lib/clover/adapter";
import { FakeCloverAdapter } from "@/src/lib/clover/fake-adapter";
import { pendingDelta, readCheckpoint, runCloverPull } from "@/src/lib/clover/pull";
import { query } from "@/src/lib/inventory/db";

import { cloverProduct, minutes, NOW, websiteSale } from "./clover-fixtures";
import { liveStock, movementsFor, setupWorld, type World } from "./inventory-fixtures";

let w: World;
let payload: Payload;

beforeAll(async () => {
  w = await setupWorld();
  payload = w.payload;
});

const at = (ms: number) => () => NOW.getTime() + ms;
const countedAt = async (id: number | string) => String((await query(payload, "SELECT stock_counted_at AS c FROM products WHERE id = :id", { id }))[0].c);
const echoes = async () => Number((await query(payload, "SELECT COUNT(*) AS n FROM outbox WHERE idempotency_key LIKE 'stock_changed:sync:%'"))[0].n);

describe("pull: applying Clover's stock", () => {
  it("applies counts as sync movements, writes no echo, stamps every item, and reports what it could not match", async () => {
    const changed = await cloverProduct(w, "PULL-CHANGED", { stock: 10 });
    const same = await cloverProduct(w, "PULL-SAME", { stock: 6, countedAt: "2026-09-01T00:00:00.000Z" });
    const unknown = await cloverProduct(w, "PULL-UNKNOWN", { stock: null });
    const bare = await cloverProduct(w, null, { stock: 3 });
    const gone = await cloverProduct(w, "PULL-GONE", { stock: 4 });
    const shared1 = await cloverProduct(w, "PULL-SHARED", { stock: 2 });
    const shared2 = await cloverProduct(w, "PULL-SHARED", { stock: 2 });
    const optioned = await cloverProduct(w, "PULL-OPTIONED", { stock: null, variants: [{ key: "pink", stock: 1 }] });
    const untracked = await cloverProduct(w, "PULL-UNTRACKED", { stock: 5 });
    const clover = new FakeCloverAdapter([
      { cloverId: "PULL-CHANGED", name: "Changed", quantity: 7 },
      { cloverId: "PULL-SAME", name: "Same", quantity: 6 },
      { cloverId: "PULL-UNKNOWN", name: "Unknown", quantity: 12 },
      { cloverId: "PULL-SHARED", name: "Shared", quantity: 9 },
      { cloverId: "PULL-OPTIONED", name: "Optioned", quantity: 8 },
      { cloverId: "PULL-UNTRACKED", name: "Untracked", quantity: null },
      { cloverId: "PULL-NOSITE", name: "Mystery chocolate", quantity: 3 },
    ]);

    const s = await runCloverPull(payload, clover, { clock: at(minutes(5)) });
    expect(s).toMatchObject({ completed: true, ok: true, stopped: "done", resumed: false });

    // Counts arrive through the ledger as sync movements.
    expect(await liveStock(payload, changed.id)).toBe(7);
    const [m] = await movementsFor(payload, changed.id);
    expect(m).toMatchObject({ reason: "sync", delta: -3, quantityAfter: 7 });
    expect(m.idempotencyKey).toBe(`sync:${s.runId}:PULL-CHANGED`);
    expect(await liveStock(payload, unknown.id)).toBe(12);
    expect((await query(payload, "SELECT stock_state AS s FROM products WHERE id = :id", { id: unknown.id }))[0].s).toBe("known");

    // No echo back to Clover.
    expect(await echoes()).toBe(0);
    expect(Number((await query(payload, "SELECT COUNT(*) AS n FROM outbox WHERE json_extract(payload, '$.productId') = :id", { id: changed.id }))[0].n)).toBe(0);

    // Freshness: stamped with the moment Clover was read, even though the number did not change.
    const readAt = new Date(NOW.getTime() + minutes(5)).toISOString();
    expect(await countedAt(changed.id)).toBe(readAt);
    expect(await countedAt(same.id)).toBe(readAt);
    expect((await movementsFor(payload, same.id)).at(-1)).toMatchObject({ reason: "sync", delta: 0 });

    // Left alone, and reported.
    expect(await liveStock(payload, bare.id)).toBe(3);
    expect(await liveStock(payload, gone.id)).toBe(4);
    expect(await liveStock(payload, shared1.id)).toBe(2);
    expect(await liveStock(payload, shared2.id)).toBe(2);
    expect(await liveStock(payload, untracked.id)).toBe(5);
    expect(await liveStock(payload, optioned.id, "pink")).toBe(1);
    const r = s.report;
    expect(r.unmatched).toEqual([{ cloverId: "PULL-NOSITE", name: "Mystery chocolate" }]); // matched by ID: the name means nothing
    expect(r.ambiguous).toEqual([{ cloverId: "PULL-SHARED", productIds: expect.arrayContaining([shared1.id, shared2.id]) }]);
    expect(r.perOption).toEqual([{ cloverId: "PULL-OPTIONED", productId: optioned.id }]);
    expect(r.untracked).toBe(1);
    expect(r.missingFromClover).toContainEqual({ productId: gone.id, cloverId: "PULL-GONE" });
    expect(r.withoutCloverId).toBeGreaterThanOrEqual(1);
    expect(r).toMatchObject({ read: 7, stamped: 3, changed: 2 });
  });

  it("adds website sales that Clover has not been told about to Clover's number", async () => {
    const p = await cloverProduct(w, "PULL-PEND", { stock: 10 });
    await websiteSale(payload, p.id, 2); // 10 -> 8, waiting in the outbox
    await websiteSale(payload, p.id, 1); // 8 -> 7
    const clover = new FakeCloverAdapter([{ cloverId: "PULL-PEND", name: "Pending", quantity: 10 }]); // Clover still says 10

    const s = await runCloverPull(payload, clover, { clock: at(minutes(10)) });
    expect(await liveStock(payload, p.id)).toBe(7); // not 10: those two sales are not forgotten
    expect(s.report.withPending).toBe(1);
    const last = (await movementsFor(payload, p.id)).at(-1)!;
    expect(last).toMatchObject({ reason: "sync", delta: 0, quantityAfter: 7 });
    expect(last.note).toContain("plus -3");
  });

  it("counts a sale delivered while the page was being read, but not one delivered before", async () => {
    const p = await cloverProduct(w, "PULL-INFLIGHT", { stock: 10 });
    const early = await websiteSale(payload, p.id, 1);
    const late = await websiteSale(payload, p.id, 2);
    await query(payload, "UPDATE outbox SET status = 'sent', sent_at = :t WHERE idempotency_key = :k", { t: new Date(NOW.getTime() + minutes(1)).toISOString(), k: early });
    await query(payload, "UPDATE outbox SET status = 'sent', sent_at = :t WHERE idempotency_key = :k", { t: new Date(NOW.getTime() + minutes(20)).toISOString(), k: late });
    expect(await pendingDelta(payload, Number(p.id), new Date(NOW.getTime() + minutes(15)))).toBe(-2);
    expect(await pendingDelta(payload, Number(p.id), new Date(NOW.getTime() + minutes(30)))).toBe(0);
  });

  it("never goes below zero when Clover is lower than the unsent sales", async () => {
    const p = await cloverProduct(w, "PULL-CLAMP", { stock: 5 });
    await websiteSale(payload, p.id, 5);
    const clover = new FakeCloverAdapter([{ cloverId: "PULL-CLAMP", name: "Clamp", quantity: 2 }]);
    const s = await runCloverPull(payload, clover, { clock: at(minutes(11)) });
    expect(await liveStock(payload, p.id)).toBe(0);
    expect(s.report.clamped).toBe(1);
  });

  it("a dry run reads and reports but changes nothing and takes no lock", async () => {
    const p = await cloverProduct(w, "PULL-DRY", { stock: 10 });
    const clover = new FakeCloverAdapter([{ cloverId: "PULL-DRY", name: "Dry", quantity: 4 }]);
    const before = (await movementsFor(payload, p.id)).length;
    const s = await runCloverPull(payload, clover, { clock: at(minutes(12)), dryRun: true });
    expect(s.report).toMatchObject({ stamped: 1, changed: 1 });
    expect(await liveStock(payload, p.id)).toBe(10);
    expect((await movementsFor(payload, p.id)).length).toBe(before);
  });

  it("two overlapping pulls: one runs, the other exits", async () => {
    const clover = new FakeCloverAdapter([{ cloverId: "PULL-LOCK", name: "Lock", quantity: 1 }]);
    await cloverProduct(w, "PULL-LOCK", { stock: 1 });
    const results = await Promise.all([runCloverPull(payload, clover, { clock: at(minutes(13)) }), runCloverPull(payload, clover, { clock: at(minutes(13)) })]);
    expect(results.map((r) => r.stopped).sort()).toEqual(["done", "locked"]);
  });
});

describe("pull: restartable batches", () => {
  it("resumes from the checkpoint and finishes the catalog without counting anything twice", async () => {
    const ids = ["RES-1", "RES-2", "RES-3", "RES-4", "RES-5"];
    const products = [];
    for (const id of ids) products.push(await cloverProduct(w, id, { stock: 1 }));
    const clover = new FakeCloverAdapter(ids.map((id, i) => ({ cloverId: id, name: id, quantity: 20 + i })));
    // The earlier tests' Clover IDs are not in this fake, so only the five new products matter here.

    const first = await runCloverPull(payload, clover, { clock: at(minutes(30)), pageSize: 2, maxPages: 1 });
    expect(first).toMatchObject({ completed: false, stopped: "paused", pages: 1, resumed: false });
    expect(await liveStock(payload, products[0].id)).toBe(20);
    expect(await liveStock(payload, products[1].id)).toBe(21);
    expect(await liveStock(payload, products[2].id)).toBe(1);
    expect(await readCheckpoint(payload, "clover-pull")).toMatchObject({ cursor: "2", completed: false, runId: first.runId });

    const second = await runCloverPull(payload, clover, { clock: at(minutes(31)), pageSize: 2 });
    expect(second).toMatchObject({ completed: true, resumed: true, runId: first.runId, pages: 2 });
    expect(clover.callsTo("listItems").map((c) => (c.args as { cursor: string | null }).cursor)).toEqual([null, "2", "4"]);
    for (const [i, p] of products.entries()) expect(await liveStock(payload, p.id)).toBe(20 + i);
    expect(second.report.read).toBe(5);
    expect(second.report.alreadyApplied).toBe(0);
    // Finished: the checkpoint now just holds the report, and the next run starts fresh.
    expect(await readCheckpoint(payload, "clover-pull")).toMatchObject({ completed: true });
    const third = await runCloverPull(payload, clover, { clock: at(minutes(40)), pageSize: 2 });
    expect(third).toMatchObject({ resumed: false, completed: true });
    expect(third.runId).not.toBe(first.runId);
  });

  it("when Clover fails mid-run it stops with the checkpoint kept, and a replayed page is harmless", async () => {
    const ids = ["FAIL-1", "FAIL-2", "FAIL-3"];
    const products = [];
    for (const id of ids) products.push(await cloverProduct(w, id, { stock: 1 }));
    const clover = new FakeCloverAdapter(ids.map((id, i) => ({ cloverId: id, name: id, quantity: 30 + i })));
    // Items from earlier tests are in no fake; page 1 = FAIL-1, FAIL-2, and the second page call fails.
    clover.listItems = ((orig) => async (opts: { cursor: string | null; limit: number }) => {
      if (opts.cursor === "2") throw new CloverTransientError("fake: 503", "server");
      return orig(opts);
    })(clover.listItems.bind(clover));

    const first = await runCloverPull(payload, clover, { clock: at(minutes(50)), pageSize: 2 });
    expect(first).toMatchObject({ completed: false, stopped: "clover_down", ok: false });
    expect(await liveStock(payload, products[0].id)).toBe(30);
    expect(await liveStock(payload, products[2].id)).toBe(1);

    // Simulate a crash after the page was applied but before the checkpoint was saved: rewind the cursor.
    await query(payload, "UPDATE sync_jobs SET checkpoint = json_set(checkpoint, '$.cursor', json('null')) WHERE key = 'clover-pull'");
    const clean = new FakeCloverAdapter(ids.map((id, i) => ({ cloverId: id, name: id, quantity: 30 + i })));
    const second = await runCloverPull(payload, clean, { clock: at(minutes(51)), pageSize: 2 });
    expect(second).toMatchObject({ completed: true, resumed: true, runId: first.runId });
    expect(second.report.alreadyApplied).toBe(2); // page 1 replayed: the keys said "already done"
    expect(await liveStock(payload, products[2].id)).toBe(32);
    expect((await movementsFor(payload, products[0].id)).filter((m) => m.reason === "sync")).toHaveLength(1);
  });
});

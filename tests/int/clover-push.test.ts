/**
 * The Clover push worker against a real Payload instance and the fake adapter (INV 06, D43):
 * each outbox row is sent once, failures back off and die at the limit, and nothing here ever
 * touches the website's stock or a real Clover endpoint.
 */
import type { Payload } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

import { getCloverSyncHealth, cloverHealthChecks } from "@/src/lib/clover/health";
import { FakeCloverAdapter } from "@/src/lib/clover/fake-adapter";
import { runCloverPush } from "@/src/lib/clover/push";
import { query } from "@/src/lib/inventory/db";
import { OUTBOX_MAX_ATTEMPTS } from "@/src/lib/inventory/outbox";

import { cloverProduct, minutes, NOW, outboxRow, websiteSale } from "./clover-fixtures";
import { liveStock, setupWorld, type World } from "./inventory-fixtures";

let w: World;
let payload: Payload;

beforeAll(async () => {
  w = await setupWorld();
  payload = w.payload;
});

const at = (ms: number) => () => NOW.getTime() + ms;

describe("push: sending the outbox", () => {
  it("sends each row once, oldest first, with its idempotency key, and records the result", async () => {
    const p = await cloverProduct(w, "CLVSEND01", { stock: 20 });
    const k1 = await websiteSale(payload, p.id, 1, { now: new Date(NOW.getTime()) });
    const k2 = await websiteSale(payload, p.id, 2, { now: new Date(NOW.getTime() + 1000) });
    const clover = new FakeCloverAdapter([{ cloverId: "CLVSEND01", name: "Send", quantity: 20 }]);

    const first = await runCloverPush(payload, clover, { clock: at(minutes(1)) });
    expect(first).toMatchObject({ sent: 2, failed: 0, dead: 0, stopped: "done", ok: true });
    expect(clover.callsTo("pushStockChange").map((c) => (c.args as { idempotencyKey: string }).idempotencyKey)).toEqual([k1, k2]);
    expect(clover.quantityOf("CLVSEND01")).toBe(17);
    expect(await outboxRow(payload, k1)).toMatchObject({ status: "sent", attempts: 1, next: null, err: null });
    expect((await outboxRow(payload, k1)).sentAt).toBe(new Date(NOW.getTime() + minutes(1)).toISOString());
    expect(await liveStock(payload, p.id)).toBe(17); // the website's own stock is never touched

    const again = await runCloverPush(payload, clover, { clock: at(minutes(2)) });
    expect(again.sent).toBe(0);
    expect(clover.callsTo("pushStockChange")).toHaveLength(2);
  });

  it("two overlapping runs send every row exactly once", async () => {
    const p = await cloverProduct(w, "CLVOVER01", { stock: 50 });
    for (let i = 0; i < 6; i++) await websiteSale(payload, p.id, 1);
    const clover = new FakeCloverAdapter([{ cloverId: "CLVOVER01", name: "Overlap", quantity: 50 }]);

    const results = await Promise.all([runCloverPush(payload, clover, { clock: at(minutes(1)), batchSize: 2 }), runCloverPush(payload, clover, { clock: at(minutes(1)), batchSize: 2 })]);
    expect(results.map((r) => r.stopped).sort()).toEqual(["done", "locked"]);
    expect(results.reduce((s, r) => s + r.sent, 0)).toBe(6);
    const keys = clover.callsTo("pushStockChange").map((c) => (c.args as { idempotencyKey: string }).idempotencyKey);
    expect(new Set(keys).size).toBe(6);
    expect(clover.quantityOf("CLVOVER01")).toBe(44);
  });

  it("a row claimed by another run is left alone, and a row changed under us is not overwritten", async () => {
    const p = await cloverProduct(w, "CLVCLAIM01", { stock: 10 });
    const claimed = await websiteSale(payload, p.id, 1);
    await query(payload, "UPDATE outbox SET next_attempt_at = :t WHERE idempotency_key = :k", { t: new Date(NOW.getTime() + minutes(5)).toISOString(), k: claimed });
    const clover = new FakeCloverAdapter([{ cloverId: "CLVCLAIM01", name: "Claim", quantity: 10 }]);
    expect((await runCloverPush(payload, clover, { clock: at(minutes(1)) })).sent).toBe(0);
    expect(clover.calls).toHaveLength(0);

    // Another process marks the row sent while our call to Clover is in flight.
    const raced = await websiteSale(payload, p.id, 1);
    const racing = new (class extends FakeCloverAdapter {
      override async pushStockChange(change: Parameters<FakeCloverAdapter["pushStockChange"]>[0]) {
        const r = await super.pushStockChange(change);
        await query(payload, "UPDATE outbox SET status = 'sent', sent_at = :t WHERE idempotency_key = :k", { t: "2026-01-01T00:00:00.000Z", k: raced });
        return r;
      }
    })([{ cloverId: "CLVCLAIM01", name: "Claim", quantity: 10 }]);
    const s = await runCloverPush(payload, racing, { clock: at(minutes(1)) });
    expect(s.lostRace).toBe(1);
    expect((await outboxRow(payload, raced)).sentAt).toBe("2026-01-01T00:00:00.000Z");
    await query(payload, "UPDATE outbox SET status = 'sent' WHERE idempotency_key = :k", { k: claimed }); // tidy so later tests start clean
  });

  it("a request that timed out after Clover applied it is retried with the same key and applied once", async () => {
    const p = await cloverProduct(w, "CLVIDEM01", { stock: 10 });
    const key = await websiteSale(payload, p.id, 3);
    const clover = new FakeCloverAdapter([{ cloverId: "CLVIDEM01", name: "Idem", quantity: 10 }]).timeoutNext("pushStockChange", 1, { applyFirst: true });

    const first = await runCloverPush(payload, clover, { clock: at(minutes(1)) });
    expect(first).toMatchObject({ sent: 0, failed: 1 });
    expect(clover.quantityOf("CLVIDEM01")).toBe(7);
    const failed = await outboxRow(payload, key);
    expect(failed).toMatchObject({ status: "failed", attempts: 1 });
    expect(failed.next).toBe(new Date(NOW.getTime() + minutes(1) + 30_000).toISOString());

    expect((await runCloverPush(payload, clover, { clock: at(minutes(1) + 10_000) })).sent).toBe(0); // not due yet
    const retry = await runCloverPush(payload, clover, { clock: at(minutes(2)) });
    expect(retry.sent).toBe(1);
    expect(clover.quantityOf("CLVIDEM01")).toBe(7); // not 4
    const sentKeys = clover.callsTo("pushStockChange").map((c) => (c.args as { idempotencyKey: string }).idempotencyKey);
    expect(sentKeys).toEqual([key, key]);
  });
});

describe("push: failures", () => {
  it("retries with growing delays and goes dead at the limit, never touching stock", async () => {
    const p = await cloverProduct(w, "CLVDEAD01", { stock: 10 });
    const key = await websiteSale(payload, p.id, 1);
    const clover = new FakeCloverAdapter([{ cloverId: "CLVDEAD01", name: "Dead", quantity: 10 }]).serverErrorNext("pushStockChange", 20);

    let t = minutes(1);
    const delays: number[] = [];
    for (let i = 1; i <= OUTBOX_MAX_ATTEMPTS; i++) {
      await runCloverPush(payload, clover, { clock: at(t) });
      const row = await outboxRow(payload, key);
      expect(row.attempts).toBe(i);
      if (i < OUTBOX_MAX_ATTEMPTS) {
        expect(row.status).toBe("failed");
        delays.push(Date.parse(row.next!) - (NOW.getTime() + t));
        t = Date.parse(row.next!) - NOW.getTime() + 1;
      }
    }
    expect(delays).toEqual([30_000, 60_000, 120_000, 240_000, 480_000, 960_000, 1_920_000]);
    expect(await outboxRow(payload, key)).toMatchObject({ status: "dead", attempts: OUTBOX_MAX_ATTEMPTS, next: null });
    expect((await outboxRow(payload, key)).err).toContain("503");

    const calls = clover.callsTo("pushStockChange").length;
    await runCloverPush(payload, clover, { clock: at(t + 100 * minutes(60)) });
    expect(clover.callsTo("pushStockChange")).toHaveLength(calls); // dead rows are not retried
    expect(await liveStock(payload, p.id)).toBe(9);
  });

  it("stops after repeated transient failures instead of burning every row's attempts", async () => {
    const p = await cloverProduct(w, "CLVDOWN01", { stock: 30 });
    const keys: string[] = [];
    for (let i = 0; i < 5; i++) keys.push(await websiteSale(payload, p.id, 1, { now: new Date(NOW.getTime() + i) }));
    const clover = new FakeCloverAdapter([{ cloverId: "CLVDOWN01", name: "Down", quantity: 30 }]).timeoutNext("pushStockChange", 10);

    const s = await runCloverPush(payload, clover, { clock: at(minutes(1)) });
    expect(s).toMatchObject({ stopped: "clover_down", failed: 3, ok: false });
    expect(clover.callsTo("pushStockChange")).toHaveLength(3);
    expect((await outboxRow(payload, keys[3])).status).toBe("pending");
    expect((await outboxRow(payload, keys[3])).attempts).toBe(0);
    const job = await query(payload, "SELECT status, last_error AS e FROM sync_jobs WHERE key = 'clover-push'");
    expect(job[0]).toMatchObject({ status: "failed" });
    await query(payload, "UPDATE outbox SET status = 'sent' WHERE idempotency_key IN (SELECT idempotency_key FROM outbox WHERE status IN ('pending','failed'))"); // tidy for later tests
  });

  it("a throttled request is not a failed attempt: the row waits and the run stops", async () => {
    const p = await cloverProduct(w, "CLVTHROT01", { stock: 10 });
    const key = await websiteSale(payload, p.id, 1);
    const clover = new FakeCloverAdapter([{ cloverId: "CLVTHROT01", name: "Throttle", quantity: 10 }]).throttleNext("pushStockChange", 90_000);
    const s = await runCloverPush(payload, clover, { clock: at(minutes(1)) });
    expect(s).toMatchObject({ stopped: "throttled", ok: true, failed: 0 });
    const row = await outboxRow(payload, key);
    expect(row).toMatchObject({ status: "pending", attempts: 0 });
    expect(row.next).toBe(new Date(NOW.getTime() + minutes(1) + 90_000).toISOString());
    expect((await runCloverPush(payload, clover, { clock: at(minutes(1) + 60_000) })).sent).toBe(0);
    expect((await runCloverPush(payload, clover, { clock: at(minutes(3)) })).sent).toBe(1);
  });

  it("a permanent rejection is dead at once; bad credentials stop the run and keep the rows", async () => {
    const p = await cloverProduct(w, "CLVPERM01", { stock: 10 });
    const rejected = await websiteSale(payload, p.id, 1);
    const clover = new FakeCloverAdapter([{ cloverId: "CLVPERM01", name: "Perm", quantity: 10 }]).rejectNext("pushStockChange", "rejected");
    expect(await runCloverPush(payload, clover, { clock: at(minutes(1)) })).toMatchObject({ dead: 1, ok: true });
    expect(await outboxRow(payload, rejected)).toMatchObject({ status: "dead", attempts: 1, next: null });

    const kept = await websiteSale(payload, p.id, 1);
    const auth = new FakeCloverAdapter([{ cloverId: "CLVPERM01", name: "Perm", quantity: 10 }]).rejectNext("pushStockChange", "auth");
    const s = await runCloverPush(payload, auth, { clock: at(minutes(2)) });
    expect(s).toMatchObject({ stopped: "auth", ok: false });
    expect(await outboxRow(payload, kept)).toMatchObject({ status: "pending", attempts: 0 });
  });

  it("checkpoints before the time budget and leaves the rest for the next run", async () => {
    const p = await cloverProduct(w, "CLVBUDG01", { stock: 40 });
    const keys: string[] = [];
    for (let i = 0; i < 5; i++) keys.push(await websiteSale(payload, p.id, 1, { now: new Date(NOW.getTime() + i) }));
    let t = NOW.getTime() + minutes(1);
    const slow = new (class extends FakeCloverAdapter {
      override async pushStockChange(change: Parameters<FakeCloverAdapter["pushStockChange"]>[0]) {
        t += 20_000; // each call "takes" 20 s
        return super.pushStockChange(change);
      }
    })([{ cloverId: "CLVBUDG01", name: "Budget", quantity: 40 }]);
    const s = await runCloverPush(payload, slow, { clock: () => t, budgetMs: 50_000 });
    expect(s).toMatchObject({ stopped: "budget", sent: 3 });
    expect((await outboxRow(payload, keys[4])).status).toBe("pending");
    t += minutes(5);
    expect((await runCloverPush(payload, slow, { clock: () => t, budgetMs: 50_000 })).sent).toBe(2);
  });
});

describe("push: rows with nothing to send to", () => {
  it("parks rows with no Clover ID, or for one option, without crashing, and sends them once the ID exists", async () => {
    const bare = await cloverProduct(w, null, { stock: 10 });
    const optioned = await cloverProduct(w, "CLVOPT01", { stock: null, variants: [{ key: "pink", stock: 5 }] });
    const noId = await websiteSale(payload, bare.id, 1);
    const option = await websiteSale(payload, optioned.id, 1, { variantKey: "pink" });
    const clover = new FakeCloverAdapter([{ cloverId: "CLVOPT01", name: "Optioned", quantity: 5 }]);

    const s = await runCloverPush(payload, clover, { clock: at(minutes(1)) });
    expect(s).toMatchObject({ unmapped: 2, sent: 0, failed: 0, dead: 0, ok: true });
    expect(clover.calls).toHaveLength(0);
    expect(await outboxRow(payload, noId)).toMatchObject({ status: "failed", attempts: 0 });
    expect((await outboxRow(payload, noId)).err).toMatch(/^not mapped:/);
    expect((await outboxRow(payload, option)).err).toMatch(/^not mapped:.*pink/);

    // Lody maps the product later: the parked row goes out by itself at the next look.
    await payload.update({ collection: "products", id: bare.id, data: { cloverId: "CLVBARE01" } as never, overrideAccess: true });
    clover.setItem({ cloverId: "CLVBARE01", name: "Bare", quantity: 10 });
    expect((await runCloverPush(payload, clover, { clock: at(minutes(2)) })).sent).toBe(0); // looked at again only after six hours
    expect((await runCloverPush(payload, clover, { clock: at(minutes(60 * 7)) })).sent).toBe(1);
    expect(clover.quantityOf("CLVBARE01")).toBe(9);
    expect((await outboxRow(payload, noId)).status).toBe("sent");
  });

  it("a dry run reports what it would do and changes nothing", async () => {
    const p = await cloverProduct(w, "CLVDRY01", { stock: 10 });
    const key = await websiteSale(payload, p.id, 1);
    const clover = new FakeCloverAdapter([{ cloverId: "CLVDRY01", name: "Dry", quantity: 10 }]);
    const s = await runCloverPush(payload, clover, { clock: at(minutes(1)), dryRun: true });
    expect(s.wouldSend).toBeGreaterThanOrEqual(1);
    expect(clover.calls).toHaveLength(0);
    expect(await outboxRow(payload, key)).toMatchObject({ status: "pending", attempts: 0 });
  });
});

describe("sync health", () => {
  it("reports counts, the oldest unsent age and the last outcome of each job", async () => {
    const health = await getCloverSyncHealth(payload, new Date(NOW.getTime() + minutes(90)));
    expect(health.outbox.sent).toBeGreaterThan(0);
    expect(health.outbox.dead).toBeGreaterThanOrEqual(1);
    expect(health.outbox.unmapped).toBeGreaterThanOrEqual(0);
    expect(health.push.lastSuccessAt).not.toBeNull();
    const lines = cloverHealthChecks(health, true);
    expect(lines.find((l) => l.check === "Clover sync: outbox")!.ok).toBe(false); // there is a dead event
    expect(cloverHealthChecks({ ...health, outbox: { ...health.outbox, dead: 0, oldestUnsentAgeMs: 1000 } }, true)[0].ok).toBe(true);
    expect(cloverHealthChecks({ ...health, outbox: { ...health.outbox, dead: 0 } }, false)[0].actual).toContain("not configured");
  });
});

/**
 * The stock ledger against a real Payload instance and the real migrations (INV 01, INV 04,
 * INV 06, AC 04, D40): holds, atomic sales, idempotency, the outbox, and the drafts-and-versions
 * trap where an old saved page would write old stock back.
 */
import type { Payload } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

import type { Product } from "@/payload-types";
import { GuardFailed } from "@/src/lib/inventory/db";
import { applyMovements, commitSale, expireHolds, holdStock, readLiveStock, releaseHolds, sellableNow } from "@/src/lib/inventory/ledger";
import { acquireJobLock, releaseJobLock } from "@/src/lib/inventory/job-lock";
import { applyInventoryView } from "@/src/lib/inventory/view";

import { liveStock, makeProduct, movementsFor, NOW, setupWorld, type World } from "./inventory-fixtures";

let w: World;
let payload: Payload;

const MIN = 60_000;
const hold = (owner: string, plan: { productId: string | number; variantKey?: string | null; quantity: number }[], extra: { now?: Date; ttlMs?: number; maxAgeMs?: number | null } = {}) =>
  holdStock(payload, {
    owner,
    plan: plan.map((l) => ({ productId: String(l.productId), variantKey: l.variantKey ?? null, quantity: l.quantity })),
    now: extra.now ?? NOW,
    ttlMs: extra.ttlMs ?? 15 * MIN,
    maxAgeMs: extra.maxAgeMs ?? null,
  });

const sell = (owner: string | null, key: string, plan: { productId: string | number; variantKey?: string | null; quantity: number }[], now = NOW) =>
  commitSale(payload, {
    owner,
    plan: plan.map((l) => ({ productId: String(l.productId), variantKey: l.variantKey ?? null, quantity: l.quantity })),
    reason: "sale",
    reference: `SP-${key}`,
    recordKey: key,
    now,
  });

beforeAll(async () => {
  w = await setupWorld();
  payload = w.payload;
});

describe("the ledger tables read back through Payload", () => {
  it("writes movement, outbox event and hold rows that Payload reads as ordinary documents", async () => {
    const p = await makeProduct(w, { title: "Readback bar", stock: 10, sku: "RB-1" });
    await payload.update({ collection: "products", id: p.id, data: { cloverId: "CLV-RB" }, overrideAccess: true });
    expect(await hold("owner-readback", [{ productId: p.id, quantity: 2 }])).toEqual({ ok: true });
    expect(await sell("owner-readback", "readback", [{ productId: p.id, quantity: 2 }])).toEqual({ ok: true, applied: true });

    const [movement] = await movementsFor(payload, p.id);
    expect(movement).toMatchObject({ delta: -2, quantityAfter: 8, reason: "sale", reference: "SP-readback", productTitle: "Readback bar", variantKey: "" });
    expect(typeof movement.idempotencyKey).toBe("string");
    expect(movement.createdAt).toBe(NOW.toISOString());

    const holds = await payload.find({ collection: "stock-holds", where: { owner: { equals: "owner-readback" } }, depth: 0, overrideAccess: true });
    expect(holds.docs).toEqual([expect.objectContaining({ quantity: 2, status: "converted", reference: "SP-readback" })]);

    const events = await payload.find({ collection: "outbox", where: { idempotencyKey: { equals: `stock_changed:${movement.idempotencyKey}` } }, depth: 0, overrideAccess: true });
    expect(events.docs).toHaveLength(1);
    expect(events.docs[0]).toMatchObject({
      eventType: "stock_changed",
      status: "pending",
      attempts: 0,
      payload: { productId: p.id, cloverId: "CLV-RB", variantKey: null, delta: -2, quantityAfter: 8, movementId: movement.id, reason: "sale", reference: "SP-readback" },
    });
  });

  it("is closed to everyone through the API", async () => {
    for (const collection of ["stock-movements", "stock-holds", "outbox"] as const) {
      await expect(payload.create({ collection, data: {} as never, user: w.owner, overrideAccess: false })).rejects.toThrow();
      await expect(payload.find({ collection, overrideAccess: false })).rejects.toThrow();
      expect((await payload.find({ collection, user: w.fulfillment, overrideAccess: false })).docs).toBeDefined();
    }
    const [m] = (await payload.find({ collection: "stock-movements", limit: 1, overrideAccess: true })).docs;
    await expect(payload.update({ collection: "stock-movements", id: m.id, data: { note: "rewritten" }, user: w.owner, overrideAccess: false })).rejects.toThrow();
    await expect(payload.delete({ collection: "stock-movements", id: m.id, user: w.owner, overrideAccess: false })).rejects.toThrow();
  });
});

describe("holds (INV 04)", () => {
  it("hold every unit or none", async () => {
    const plenty = await makeProduct(w, { stock: 10 });
    const scarce = await makeProduct(w, { stock: 3, reserve: 1 }); // 2 sellable
    expect(await hold("o-all-or-none", [{ productId: plenty.id, quantity: 2 }, { productId: scarce.id, quantity: 3 }])).toMatchObject({ ok: false, short: [expect.objectContaining({ available: 2 })] });
    const rows = await payload.find({ collection: "stock-holds", where: { owner: { equals: "o-all-or-none" } }, overrideAccess: true });
    expect(rows.totalDocs).toBe(0);
    expect(await hold("o-all-or-none", [{ productId: plenty.id, quantity: 2 }, { productId: scarce.id, quantity: 2 }])).toEqual({ ok: true });
  });

  it("lower what others can buy, and expired holds don't", async () => {
    const p = await makeProduct(w, { stock: 5, reserve: 1 }); // 4 sellable
    expect(await hold("o-a", [{ productId: p.id, quantity: 3 }])).toEqual({ ok: true });
    expect(await sellableNow(payload, { productId: String(p.id), variantKey: null }, { now: NOW, maxAgeMs: null })).toBe(1);
    // The holder itself still sees its own units.
    expect(await sellableNow(payload, { productId: String(p.id), variantKey: null }, { now: NOW, maxAgeMs: null, exceptOwner: "o-a" })).toBe(4);
    // Another customer can't take 2…
    expect(await hold("o-b", [{ productId: p.id, quantity: 2 }])).toMatchObject({ ok: false });
    // …until the first hold has expired (the table row is still there; it is just ignored).
    const later = new Date(NOW.getTime() + 16 * MIN);
    expect(await sellableNow(payload, { productId: String(p.id), variantKey: null }, { now: later, maxAgeMs: null })).toBe(4);
    expect(await hold("o-b", [{ productId: p.id, quantity: 2 }], { now: later })).toEqual({ ok: true });
  });

  it("show up in what the storefront and bag see, minus the owner's own", async () => {
    const p = await makeProduct(w, { stock: 5, reserve: 1 });
    await hold("o-view", [{ productId: p.id, quantity: 3 }]);
    const doc = (await payload.findByID({ collection: "products", id: p.id, depth: 0, overrideAccess: true })) as Product;
    const others = (await applyInventoryView(payload, [doc], { now: NOW })).products[0];
    expect(others.stockQuantity).toBe(2);
    const own = (await applyInventoryView(payload, [doc], { now: NOW, exceptOwner: "o-view" })).products[0];
    expect(own.stockQuantity).toBe(5);
    const expired = (await applyInventoryView(payload, [doc], { now: new Date(NOW.getTime() + 20 * MIN) })).products[0];
    expect(expired.stockQuantity).toBe(5);
  });

  it("are replaced, not stacked, when the same owner holds again", async () => {
    const p = await makeProduct(w, { stock: 5, reserve: 1 });
    await hold("o-again", [{ productId: p.id, quantity: 3 }]);
    expect(await hold("o-again", [{ productId: p.id, quantity: 4 }])).toEqual({ ok: true }); // would fail if 3 were still counted
    const rows = await payload.find({ collection: "stock-holds", where: { owner: { equals: "o-again" } }, overrideAccess: true });
    expect(rows.docs).toEqual([expect.objectContaining({ quantity: 4, status: "active" })]);
  });

  it("can be released, and the cron marks overdue ones expired and tidies old ones", async () => {
    const p = await makeProduct(w, { stock: 5, reserve: 1 });
    await hold("o-rel", [{ productId: p.id, quantity: 2 }]);
    expect(await releaseHolds(payload, "o-rel", NOW)).toBe(1);
    expect(await releaseHolds(payload, "o-rel", NOW)).toBe(0);

    await hold("o-exp", [{ productId: p.id, quantity: 2 }]);
    const later = new Date(NOW.getTime() + 20 * MIN);
    expect((await expireHolds(payload, later)).expired).toBeGreaterThanOrEqual(1); // earlier tests' holds lapse too
    const row = (await payload.find({ collection: "stock-holds", where: { owner: { equals: "o-exp" } }, overrideAccess: true })).docs[0];
    expect(row.status).toBe("expired");
    const muchLater = new Date(NOW.getTime() + 30 * 24 * 3600_000);
    expect((await expireHolds(payload, muchLater)).pruned).toBeGreaterThanOrEqual(2);
  });

  it("is held per option, with each option's own stock", async () => {
    const p = await makeProduct(w, { stock: null, variants: [{ key: "pink", stock: 3 }, { key: "blue", stock: 3 }] });
    expect(await hold("o-opt", [{ productId: p.id, variantKey: "pink", quantity: 2 }])).toEqual({ ok: true });
    expect(await hold("o-opt2", [{ productId: p.id, variantKey: "pink", quantity: 1 }])).toMatchObject({ ok: false });
    expect(await hold("o-opt2", [{ productId: p.id, variantKey: "blue", quantity: 2 }])).toEqual({ ok: true });
  });

  it("never use unknown stock", async () => {
    const p = await makeProduct(w, { stock: null });
    expect(await hold("o-unk", [{ productId: p.id, quantity: 1 }])).toMatchObject({ ok: false });
  });
});

describe("sales (INV 01, AC 04)", () => {
  it("move each component once, however often the same record is committed", async () => {
    const a = await makeProduct(w, { stock: 10 });
    const b = await makeProduct(w, { stock: 10 });
    const plan = [{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 3 }];
    await hold("o-once", plan);
    expect(await sell("o-once", "once", plan)).toEqual({ ok: true, applied: true });
    expect(await sell("o-once", "once", plan)).toEqual({ ok: true, applied: false });
    const [again] = await Promise.all([sell("o-once", "once", plan), sell("o-once", "once", plan)]);
    expect(again).toMatchObject({ ok: true });
    expect(await liveStock(payload, a.id)).toBe(8);
    expect(await liveStock(payload, b.id)).toBe(7);
    expect(await movementsFor(payload, a.id)).toHaveLength(1);
    expect(await movementsFor(payload, b.id)).toHaveLength(1);
  });

  it("never take a unit below the in-store reserve: two buyers, one sellable unit", async () => {
    const p = await makeProduct(w, { stock: 2, reserve: 1 }); // exactly one sellable
    const results = await Promise.all([
      (async () => ((await hold("race-a", [{ productId: p.id, quantity: 1 }])).ok ? sell("race-a", "race-a", [{ productId: p.id, quantity: 1 }]) : { ok: false }))(),
      (async () => ((await hold("race-b", [{ productId: p.id, quantity: 1 }])).ok ? sell("race-b", "race-b", [{ productId: p.id, quantity: 1 }]) : { ok: false }))(),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await liveStock(payload, p.id)).toBe(1);
    expect(await movementsFor(payload, p.id)).toHaveLength(1);
  });

  it("refuse a late sale whose hold has expired when the stock is gone, taking nothing at all", async () => {
    const a = await makeProduct(w, { stock: 5 });
    const b = await makeProduct(w, { stock: 2, reserve: 1 });
    const plan = [{ productId: a.id, quantity: 1 }, { productId: b.id, quantity: 1 }];
    await hold("late-1", plan); // takes b's only sellable unit
    const later = new Date(NOW.getTime() + 30 * MIN);
    // Meanwhile someone else sold the unit once the hold had lapsed.
    expect(await hold("late-2", [{ productId: b.id, quantity: 1 }], { now: later })).toEqual({ ok: true });
    expect(await sell("late-2", "late-2", [{ productId: b.id, quantity: 1 }], later)).toMatchObject({ ok: true });
    // The first customer's "paid" arrives now: b can't be taken, so neither is a.
    const result = await sell("late-1", "late-1", plan, later);
    expect(result).toMatchObject({ ok: false, short: [expect.objectContaining({ unit: { productId: String(b.id), variantKey: null } })] });
    expect(await liveStock(payload, a.id)).toBe(5);
    expect(await liveStock(payload, b.id)).toBe(1);
  });

  it("take a late sale after its hold expired when the stock is still there", async () => {
    const p = await makeProduct(w, { stock: 5 });
    await hold("late-ok", [{ productId: p.id, quantity: 2 }]);
    const later = new Date(NOW.getTime() + 30 * MIN);
    expect(await sell("late-ok", "late-ok", [{ productId: p.id, quantity: 2 }], later)).toEqual({ ok: true, applied: true });
    expect(await liveStock(payload, p.id)).toBe(3);
  });

  it("respect other customers' live holds even without one of its own", async () => {
    const p = await makeProduct(w, { stock: 4, reserve: 1 }); // 3 sellable
    await hold("holder", [{ productId: p.id, quantity: 2 }]);
    expect(await sell(null, "nohold", [{ productId: p.id, quantity: 2 }])).toMatchObject({ ok: false });
    expect(await sell(null, "nohold-1", [{ productId: p.id, quantity: 1 }])).toMatchObject({ ok: true });
  });

  it("move option stock, not the product's", async () => {
    const p = await makeProduct(w, { stock: 50, variants: [{ key: "pink", stock: 4 }, { key: "blue", stock: 4 }] });
    await hold("o-var", [{ productId: p.id, variantKey: "pink", quantity: 2 }]);
    await sell("o-var", "var", [{ productId: p.id, variantKey: "pink", quantity: 2 }]);
    expect(await liveStock(payload, p.id, "pink")).toBe(2);
    expect(await liveStock(payload, p.id, "blue")).toBe(4);
    expect(await liveStock(payload, p.id)).toBe(50);
    expect((await movementsFor(payload, p.id))[0]).toMatchObject({ variantKey: "pink", quantityAfter: 2 });
  });
});

describe("staff counts and adjustments, atomically", () => {
  it("refuse a change that would go below zero, taking nothing from any line", async () => {
    const a = await makeProduct(w, { stock: 5 });
    const b = await makeProduct(w, { stock: 1 });
    const move = (id: number, amount: number, key: string) => ({ unit: { productId: String(id), variantKey: null }, mode: "delta" as const, amount, reason: "manual_adjustment" as const, idempotencyKey: key });
    await expect(applyMovements(payload, [move(a.id, -2, "adj-x1"), move(b.id, -2, "adj-x2")], NOW)).rejects.toBeInstanceOf(GuardFailed);
    expect(await liveStock(payload, a.id)).toBe(5);
    expect(await movementsFor(payload, a.id)).toHaveLength(0);
    const [done] = await applyMovements(payload, [move(a.id, -2, "adj-y1")], NOW);
    expect(done).toMatchObject({ delta: -2, quantityAfter: 3 });
  });

  it("refuse to adjust a quantity that was never counted, but a count starts it", async () => {
    const p = await makeProduct(w, { stock: null });
    const unit = { productId: String(p.id), variantKey: null };
    await expect(applyMovements(payload, [{ unit, mode: "delta", amount: 5, reason: "manual_adjustment", idempotencyKey: "adj-unk" }], NOW)).rejects.toBeInstanceOf(GuardFailed);
    const countedAt = new Date("2026-10-05T13:00:00Z");
    const [counted] = await applyMovements(payload, [{ unit, mode: "count", amount: 12, reason: "count_correction", idempotencyKey: "cnt-1", countedAt }], NOW);
    expect(counted).toMatchObject({ delta: 12, quantityAfter: 12 });
    const live = await readLiveStock(payload, p.id);
    expect(live).toMatchObject({ stockState: "known", stockQuantity: 12, stockCountedAt: countedAt.toISOString() });
  });

  it("record a recount as the difference, and no outbox event when nothing changed or when it came from Clover", async () => {
    const p = await makeProduct(w, { stock: 10 });
    const unit = { productId: String(p.id), variantKey: null };
    const count = (amount: number, key: string, reason: "count_correction" | "sync") => applyMovements(payload, [{ unit, mode: "count", amount, reason, idempotencyKey: key }], NOW);
    expect((await count(7, "rc-1", "count_correction"))[0]).toMatchObject({ delta: -3, quantityAfter: 7 });
    expect((await count(7, "rc-2", "count_correction"))[0]).toMatchObject({ delta: 0, quantityAfter: 7 });
    expect((await count(9, "rc-3", "sync"))[0]).toMatchObject({ delta: 2, quantityAfter: 9 });
    const events = await payload.find({ collection: "outbox", where: { idempotencyKey: { like: "stock_changed:rc-" } }, sort: "id", depth: 0, overrideAccess: true });
    expect(events.docs.map((e) => e.idempotencyKey)).toEqual(["stock_changed:rc-1"]);
    const movements = await movementsFor(payload, p.id);
    expect(movements.map((m) => [m.reason, m.delta])).toEqual([["count_correction", -3], ["count_correction", 0], ["sync", 2]]);
  });

  it("apply two adjustments racing on the same unit one after the other, never losing either", async () => {
    const p = await makeProduct(w, { stock: 10 });
    const unit = { productId: String(p.id), variantKey: null };
    const adj = (key: string) => applyMovements(payload, [{ unit, mode: "delta", amount: -3, reason: "manual_adjustment", idempotencyKey: key }], NOW);
    await Promise.all([adj("race-adj-1"), adj("race-adj-2"), adj("race-adj-3")]);
    expect(await liveStock(payload, p.id)).toBe(1);
    expect((await movementsFor(payload, p.id)).map((m) => m.quantityAfter).sort((x, y) => x - y)).toEqual([1, 4, 7]);
  });
});

describe("drafts and versions can't write old stock back (D40)", () => {
  async function sellOne(p: Product) {
    const owner = `ver-${p.id}-${Math.random()}`;
    await hold(owner, [{ productId: p.id, quantity: 1 }]);
    await sell(owner, `ver-${p.id}-${Math.random()}`, [{ productId: p.id, quantity: 1 }]);
  }

  it("keeps the post-sale stock through an unrelated save", async () => {
    const p = await makeProduct(w, { stock: 10 });
    await sellOne(p);
    await payload.update({ collection: "products", id: p.id, data: { priceCents: 777 }, overrideAccess: true });
    expect(await liveStock(payload, p.id)).toBe(9);
    // The same save from the admin, by a manager.
    await payload.update({ collection: "products", id: p.id, data: { priceCents: 778 }, user: w.manager, overrideAccess: false });
    expect(await liveStock(payload, p.id)).toBe(9);
  });

  it("keeps the post-sale stock when a draft saved before the sale is published after it", async () => {
    const p = await makeProduct(w, { stock: 10 });
    // Staff open the product and save a draft: its snapshot carries stock 10.
    await payload.update({ collection: "products", id: p.id, data: { shortDescription: "New words" }, draft: true, user: w.manager, overrideAccess: false });
    await sellOne(p);
    expect(await liveStock(payload, p.id)).toBe(9);
    await payload.update({ collection: "products", id: p.id, data: { _status: "published" }, draft: false, user: w.manager, overrideAccess: false });
    const after = (await payload.findByID({ collection: "products", id: p.id, depth: 0, overrideAccess: true })) as Product;
    expect(after.shortDescription).toBe("New words");
    expect(after.stockQuantity).toBe(9);
  });

  it("keeps the post-sale stock when an older version is restored", async () => {
    const p = await makeProduct(w, { stock: 10 });
    await payload.update({ collection: "products", id: p.id, data: { priceCents: 600 }, overrideAccess: true }); // version with stock 10
    await sellOne(p);
    const versions = await payload.findVersions({ collection: "products", where: { parent: { equals: p.id } }, sort: "createdAt", depth: 0, overrideAccess: true });
    const oldest = versions.docs[0];
    expect((oldest.version as Product).stockQuantity).toBe(10);
    await payload.restoreVersion({ collection: "products", id: oldest.id, user: w.manager, overrideAccess: false });
    expect(await liveStock(payload, p.id)).toBe(9);
  });

  it("keeps option stock through a save that sends the options back unchanged", async () => {
    const p = await makeProduct(w, { stock: null, variants: [{ key: "pink", stock: 4 }, { key: "blue", stock: 4 }] });
    const owner = "ver-opt";
    await hold(owner, [{ productId: p.id, variantKey: "pink", quantity: 1 }]);
    await sell(owner, "ver-opt", [{ productId: p.id, variantKey: "pink", quantity: 1 }]);
    const stale = (await payload.findVersions({ collection: "products", where: { parent: { equals: p.id } }, depth: 0, overrideAccess: true })).docs[0].version as Product;
    await payload.update({ collection: "products", id: p.id, data: { variants: stale.variants, priceCents: 650 }, user: w.manager, overrideAccess: false });
    expect(await liveStock(payload, p.id, "pink")).toBe(3);
    expect(await liveStock(payload, p.id, "blue")).toBe(4);
  });

  it("ignores stock typed into the product form by staff, and shows staff the live number", async () => {
    const p = await makeProduct(w, { stock: 10 });
    const saved = await payload.update({ collection: "products", id: p.id, data: { stockQuantity: 999, stockState: "known" }, user: w.manager, overrideAccess: false });
    expect(saved.stockQuantity).toBe(10);
    expect(await liveStock(payload, p.id)).toBe(10);
    await sellOne(p);
    // A draft read (what the admin form loads) shows the live number, not the version snapshot.
    const form = (await payload.findByID({ collection: "products", id: p.id, draft: true, depth: 0, user: w.manager, overrideAccess: false })) as Product;
    expect(form.stockQuantity).toBe(9);
  });

  it("starts a product made in the admin uncounted, and a new option too", async () => {
    const made = (await payload.create({
      collection: "products",
      data: { title: "Admin made", category: w.category.id, channel: "online", stockState: "known", stockQuantity: 50, variants: [{ key: "red", label: "Red", stockState: "known", stockQuantity: 9 }] } as never,
      user: w.manager,
      overrideAccess: false,
    })) as Product;
    expect(made).toMatchObject({ stockState: "unknown", stockQuantity: null });
    expect(made.variants?.[0]).toMatchObject({ stockState: "unknown", stockQuantity: null });
    const p = await makeProduct(w, { stock: null, variants: [{ key: "pink", stock: 4 }] });
    const updated = await payload.update({
      collection: "products",
      id: p.id,
      data: { variants: [{ key: "pink", label: "Pink" }, { key: "green", label: "Green", stockState: "known", stockQuantity: 20 }] } as never,
      user: w.manager,
      overrideAccess: false,
    });
    expect(updated.variants?.map((v) => [v.key, v.stockState, v.stockQuantity])).toEqual([["pink", "known", 4], ["green", "unknown", null]]);
  });
});

describe("cron lock", () => {
  it("lets one run own a job at a time, and a dead run's lock expire", async () => {
    const first = await acquireJobLock(payload, "test-job", 5 * MIN, NOW);
    expect(first).toEqual(expect.any(String));
    expect(await acquireJobLock(payload, "test-job", 5 * MIN, new Date(NOW.getTime() + MIN))).toBeNull();
    await releaseJobLock(payload, "test-job", first!, new Date(NOW.getTime() + 2 * MIN), { ok: true });
    const second = await acquireJobLock(payload, "test-job", 5 * MIN, new Date(NOW.getTime() + 3 * MIN));
    expect(second).toEqual(expect.any(String));
    // Never released: the lock expires and the next run takes over.
    expect(await acquireJobLock(payload, "test-job", 5 * MIN, new Date(NOW.getTime() + 10 * MIN))).toEqual(expect.any(String));
    const row = (await payload.find({ collection: "sync-jobs", where: { key: { equals: "test-job" } }, overrideAccess: true })).docs[0];
    expect(row).toMatchObject({ status: "running", lastSuccessAt: new Date(NOW.getTime() + 2 * MIN).toISOString() });
  });
});

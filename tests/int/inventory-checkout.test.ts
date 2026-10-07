/**
 * Checkout and stock together (INV 01, INV 04, INV 06, AC 04, A02, A01, D40): the last unit can't
 * be oversold, each component moves once, holds last only while paying, a failed charge frees the
 * stock, and a paid order is never lost or charged twice when the shelf can't cover it.
 */
import type { Payload } from "payload";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Order, Product, Reservation } from "@/payload-types";
import { sellableUnits } from "@/src/lib/catalog/product";
import { changeBag, findByToken, loadCheckoutContext, newCartToken, placeOrder, priceBag, priceBasket, reserveBasket, type BasketDraft, type CheckoutContext } from "@/src/lib/checkout/service";
import { reconcilePaidHeld } from "@/src/lib/inventory/settle";
import { applyMovements } from "@/src/lib/inventory/ledger";
import { loadBuilderCatalogFrom } from "@/src/lib/catalog/builder-catalog";
import type { PaymentProvider } from "@/src/lib/payments";
import { testProvider } from "@/src/lib/payments";

import { bagWith, CONTACT, FORM, liveStock, makeProduct, movementsFor, NOW, setupWorld, type World } from "./inventory-fixtures";

let w: World;
let payload: Payload;
let ctx: CheckoutContext;

const withProvider = (provider: PaymentProvider): CheckoutContext => ({ ...ctx, provider });
const declining: PaymentProvider = { id: "decline", test: true, async charge() { return { status: "failed", reference: "", message: "declined" }; } };

function counting(inner: PaymentProvider = testProvider) {
  const calls: string[] = [];
  const provider: PaymentProvider = { ...inner, async charge(input) { calls.push(input.reference); return inner.charge(input); } };
  return { provider, calls };
}

const order = async (number: string) => (await payload.find({ collection: "orders", where: { number: { equals: number } }, depth: 0, overrideAccess: true })).docs[0] as Order;
const place = (token: string, form: Record<string, unknown> = FORM, c: CheckoutContext = ctx) => placeOrder(payload, { cartToken: token, form, now: NOW }, c);

beforeAll(async () => {
  w = await setupWorld();
  payload = w.payload;
  ctx = w.ctx;
});

describe("the last unit (AC 04)", () => {
  it("goes to exactly one of two simultaneous checkouts, and stock never drops below the in-store reserve", async () => {
    const p = await makeProduct(w, { title: "Last bar", stock: 2, reserve: 1 }); // one sellable
    const a = await bagWith(w, p.id);
    const b = await bagWith(w, p.id); // both bags were valid when filled
    const [ra, rb] = await Promise.all([place(a), place(b, { ...FORM, name: "Sam Second" })]);
    expect([ra.ok, rb.ok].sort()).toEqual([false, true]);
    const failed = ra.ok ? rb : ra;
    expect(failed).toMatchObject({ ok: false, error: expect.stringMatching(/aren't available/) });
    expect(await liveStock(payload, p.id)).toBe(1);
    expect(await movementsFor(payload, p.id)).toHaveLength(1);
    const committed = await payload.find({ collection: "orders", where: { stockStatus: { equals: "committed" } }, limit: 100, depth: 0, overrideAccess: true });
    expect(committed.docs.filter((o) => (o.stockPlan as { productId: string }[])[0]?.productId === String(p.id))).toHaveLength(1);
  });

  it("is also protected across many simultaneous buyers", async () => {
    const p = await makeProduct(w, { title: "Popular bar", stock: 4, reserve: 1 }); // three sellable
    const tokens = await Promise.all([1, 2, 3, 4, 5].map(() => bagWith(w, p.id)));
    const results = await Promise.all(tokens.map((t, i) => place(t, { ...FORM, name: `Buyer ${i}` })));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(await liveStock(payload, p.id)).toBe(1);
    expect(await movementsFor(payload, p.id)).toHaveLength(3);
  });
});

describe("each component moves once", () => {
  it("treats the same order submitted twice as one order and one stock movement", async () => {
    const p = await makeProduct(w, { stock: 10 });
    const token = await bagWith(w, p.id, 2);
    const [a, b] = await Promise.all([place(token), place(token)]);
    expect(a).toEqual(b);
    // Submitted a third time after the bag was cleared and the order paid: still the one order.
    expect(await liveStock(payload, p.id)).toBe(8);
    expect(await movementsFor(payload, p.id)).toHaveLength(1);
    if (!a.ok) throw new Error(a.error);
    const saved = await findByToken(payload, "orders", a.number, a.token);
    expect(saved).toMatchObject({ paymentStatus: "paid", stockStatus: "committed", stockPlan: [{ productId: String(p.id), variantKey: null, quantity: 2 }] });
  });

  it("deducts an option from the option, not the product", async () => {
    const p = await makeProduct(w, { stock: null, variants: [{ key: "pink", stock: 5 }, { key: "blue", stock: 5 }] });
    const token = await bagWith(w, `${p.id}:blue`, 2);
    const result = await place(token);
    expect(result.ok).toBe(true);
    expect(await liveStock(payload, p.id, "blue")).toBe(3);
    expect(await liveStock(payload, p.id, "pink")).toBe(5);
  });
});

describe("a curated basket with a bill of materials (INV 01)", () => {
  it("deducts its components and never the basket itself", async () => {
    const choc = await makeProduct(w, { title: "Truffles", stock: 20, reserve: 2 });
    const box = await makeProduct(w, { title: "Gift box", stock: 6, reserve: 1 });
    const basket = await makeProduct(w, {
      title: "Small curated basket",
      stock: null,
      reserve: 1,
      priceCents: 4500,
      components: [{ product: choc.id, quantity: 6 }, { product: box.id, quantity: 1 }],
    });
    // Sellable baskets: truffles (20 − 2) / 6 = 3, box (6 − 1) / 1 = 5 → 3.
    const token = newCartToken();
    expect(await changeBag(payload, token, { unitId: String(basket.id), quantity: 9, mode: "add" }, ctx, NOW)).toEqual({ ok: true });
    const bag = await priceBag(payload, token, ctx, NOW);
    expect(bag.payable).toEqual([expect.objectContaining({ quantity: 3 })]); // clamped to what the components allow

    const result = await place(token);
    if (!result.ok) throw new Error(result.error);
    expect(await liveStock(payload, choc.id)).toBe(2); // 20 − 3 × 6
    expect(await liveStock(payload, box.id)).toBe(3); // 6 − 3 × 1
    expect(await movementsFor(payload, basket.id)).toEqual([]);
    const saved = (await findByToken(payload, "orders", result.number, result.token)) as Order;
    expect(saved.stockPlan).toEqual([
      { productId: String(choc.id), variantKey: null, quantity: 18 },
      { productId: String(box.id), variantKey: null, quantity: 3 },
    ]);
    expect(saved.lines).toEqual([expect.objectContaining({ title: "Small curated basket", quantity: 3 })]);
    expect((await payload.findByID({ collection: "products", id: basket.id, depth: 0, overrideAccess: true })).stockQuantity).toBeNull();
  });

  it("sells out when a component does, and counts a component bought on its own too", async () => {
    const choc = await makeProduct(w, { stock: 8, reserve: 1 });
    const basket = await makeProduct(w, { stock: null, components: [{ product: choc.id, quantity: 3 }] });
    const token = newCartToken();
    await changeBag(payload, token, { unitId: String(basket.id), quantity: 1, mode: "add" }, ctx); // takes 3
    await changeBag(payload, token, { unitId: String(choc.id), quantity: 4, mode: "add" }, ctx); // takes 4 more: 7 = all sellable
    const result = await place(token);
    expect(result.ok).toBe(true);
    expect(await liveStock(payload, choc.id)).toBe(1);
    expect(await movementsFor(payload, choc.id)).toHaveLength(1); // one merged movement for the component
    const other = newCartToken();
    expect(await changeBag(payload, other, { unitId: String(basket.id), quantity: 1, mode: "add" }, ctx)).toMatchObject({ ok: false });
  });

  it("is unavailable until every component is counted, and falls back to its own stock without contents", async () => {
    const uncounted = await makeProduct(w, { stock: null });
    const basket = await makeProduct(w, { stock: null, components: [{ product: uncounted.id, quantity: 1 }] });
    expect(await changeBag(payload, newCartToken(), { unitId: String(basket.id), quantity: 1, mode: "add" }, ctx)).toMatchObject({ ok: false });

    const plain = await makeProduct(w, { stock: 5, reserve: 1 });
    const token = await bagWith(w, plain.id, 2);
    await place(token);
    expect(await liveStock(payload, plain.id)).toBe(3);
  });

  it("can't be saved with contents that point at itself, a missing option or another basket", async () => {
    const part = await makeProduct(w, { stock: null, variants: [{ key: "gold", stock: 1 }] });
    const inner = await makeProduct(w, { stock: null, components: [{ product: part.id, variantKey: "gold", quantity: 1 }] });
    const save = (components: { product: number; variantKey?: string; quantity: number }[]) =>
      payload.update({ collection: "products", id: inner.id, data: { components, _status: "published" } as never, user: w.manager, overrideAccess: false });
    await expect(save([{ product: inner.id, quantity: 1 }])).rejects.toThrow(/contain itself/);
    await expect(save([{ product: part.id, quantity: 1 }])).rejects.toThrow(/has options/);
    const other = await makeProduct(w, { stock: null });
    await expect(payload.update({ collection: "products", id: other.id, data: { components: [{ product: inner.id, quantity: 1 }], _status: "published" } as never, user: w.manager, overrideAccess: false })).rejects.toThrow(/can't be nested/);
  });
});

describe("holds while paying (INV 04)", () => {
  it("keep the last unit from a second customer until the first payment finishes", async () => {
    const p = await makeProduct(w, { stock: 2, reserve: 1 });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let started!: () => void;
    const inFlight = new Promise<void>((resolve) => (started = resolve));
    const slow: PaymentProvider = { ...testProvider, async charge(input) { started(); await gate; return testProvider.charge(input); } };

    const first = place(await bagWith(w, p.id), FORM, withProvider(slow));
    await inFlight;
    // The first customer is mid-payment: their unit is held, not yet sold.
    expect(await liveStock(payload, p.id)).toBe(2);
    const second = newCartToken();
    expect(await changeBag(payload, second, { unitId: String(p.id), quantity: 1, mode: "add" }, ctx, NOW)).toMatchObject({ ok: false });
    release();
    expect((await first).ok).toBe(true);
    expect(await liveStock(payload, p.id)).toBe(1);
  });

  it("are released when the charge is declined, and a retry then succeeds and takes the stock once", async () => {
    const p = await makeProduct(w, { stock: 2, reserve: 1 });
    const token = await bagWith(w, p.id);
    expect(await place(token, FORM, withProvider(declining))).toMatchObject({ ok: false, error: expect.stringMatching(/payment didn't go through/) });
    expect(await liveStock(payload, p.id)).toBe(2);
    const holds = await payload.find({ collection: "stock-holds", where: { product: { equals: p.id } }, depth: 0, overrideAccess: true });
    expect(holds.docs.map((h) => h.status)).toEqual(["released"]);
    const failed = (await payload.find({ collection: "orders", where: { stockStatus: { equals: "released" } }, depth: 0, overrideAccess: true })).docs.at(-1)!;
    expect(failed).toMatchObject({ paymentStatus: "failed" });

    // The unit is free again for someone else to see…
    expect(await changeBag(payload, newCartToken(), { unitId: String(p.id), quantity: 1, mode: "add" }, ctx, NOW)).toEqual({ ok: true });
    // …and the same customer retrying pays and takes it exactly once.
    const retry = await place(token);
    expect(retry.ok).toBe(true);
    expect(await liveStock(payload, p.id)).toBe(1);
    expect(await movementsFor(payload, p.id)).toHaveLength(1);
    const orders = await payload.find({ collection: "orders", where: { number: { equals: failed.number } }, depth: 0, overrideAccess: true });
    expect(orders.docs[0]).toMatchObject({ paymentStatus: "paid", stockStatus: "committed" });
  });

  it("are released when the payment provider throws", async () => {
    const p = await makeProduct(w, { stock: 2, reserve: 1 });
    const boom: PaymentProvider = { ...testProvider, async charge() { throw new Error("gateway timeout"); } };
    await expect(place(await bagWith(w, p.id), FORM, withProvider(boom))).rejects.toThrow(/gateway timeout/);
    const holds = await payload.find({ collection: "stock-holds", where: { product: { equals: p.id } }, depth: 0, overrideAccess: true });
    expect(holds.docs.every((h) => h.status === "released")).toBe(true);
    expect(await liveStock(payload, p.id)).toBe(2);
    expect(await changeBag(payload, newCartToken(), { unitId: String(p.id), quantity: 1, mode: "add" }, ctx, NOW)).toEqual({ ok: true });
  });

  it("last for the hold time from Settings → Inventory (15 minutes to start with)", async () => {
    const hold = async (c: CheckoutContext) => {
      const p = await makeProduct(w, { stock: 2, reserve: 1 });
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      let started!: () => void;
      const inFlight = new Promise<void>((resolve) => (started = resolve));
      const slow: PaymentProvider = { ...testProvider, async charge(input) { started(); await gate; return testProvider.charge(input); } };
      const pending = place(await bagWith(w, p.id), FORM, { ...c, provider: slow });
      await inFlight;
      const rows = await payload.find({ collection: "stock-holds", where: { product: { equals: p.id } }, depth: 0, overrideAccess: true });
      release();
      await pending;
      return new Date(rows.docs[0].expiresAt).getTime() - NOW.getTime();
    };
    expect(ctx.inventory.holdMinutes).toBe(15);
    expect(await hold(ctx)).toBe(15 * 60_000);
    await payload.updateGlobal({ slug: "inventory-settings", data: { holdMinutes: 5 }, user: w.manager, overrideAccess: false });
    const short = await loadCheckoutContext(payload, { APP_ENV: "test" });
    expect(await hold(short)).toBe(5 * 60_000);
    await payload.updateGlobal({ slug: "inventory-settings", data: { holdMinutes: 15 }, overrideAccess: true });
  });
});

describe("a paid order is never lost (INV 06)", () => {
  it("is kept and flagged for staff when the stock can't be taken after payment, and is never charged again", async () => {
    const p = await makeProduct(w, { title: "Vanishing bar", stock: 3, reserve: 1 });
    const { provider, calls } = counting();
    // While the customer pays, a staff count finds the shelf nearly empty.
    const racing: PaymentProvider = {
      ...provider,
      async charge(input) {
        await applyMovements(payload, [{ unit: { productId: String(p.id), variantKey: null }, mode: "count", amount: 0, reason: "count_correction", idempotencyKey: `vanish-${calls.length}` }], NOW);
        return provider.charge(input);
      },
    };
    const token = await bagWith(w, p.id, 2);
    const result = await place(token, FORM, withProvider(racing));
    if (!result.ok) throw new Error(result.error);
    const saved = (await findByToken(payload, "orders", result.number, result.token)) as Order;
    expect(saved).toMatchObject({ paymentStatus: "paid", stockStatus: "needs_attention", fulfillmentStatus: "staff_review" });
    expect(saved.stockNote).toMatch(/Vanishing bar/);
    expect(await liveStock(payload, p.id)).toBe(0); // the count, and nothing was taken on top
    expect((await movementsFor(payload, p.id)).map((m) => m.reason)).toEqual(["count_correction"]);

    // Pressing submit again finds nothing to buy and never reaches the payment provider.
    expect(await place(token, FORM, withProvider(racing))).toMatchObject({ ok: false });
    expect(calls).toHaveLength(1);
    expect(await liveStock(payload, p.id)).toBe(0);
  });

  it("can be marked resolved by a manager, and by nobody else, once the stock is fixed", async () => {
    const [flagged] = (await payload.find({ collection: "orders", where: { stockStatus: { equals: "needs_attention" } }, depth: 0, overrideAccess: true })).docs;
    const byStaff = await payload.update({ collection: "orders", id: flagged.id, data: { stockStatus: "resolved" }, user: w.fulfillment, overrideAccess: false });
    expect(byStaff.stockStatus).toBe("needs_attention"); // field access strips it
    await expect(payload.update({ collection: "orders", id: flagged.id, data: { stockStatus: "committed" }, user: w.manager, overrideAccess: false })).rejects.toThrow(/Resolved/);
    const done = await payload.update({ collection: "orders", id: flagged.id, data: { stockStatus: "resolved" }, user: w.manager, overrideAccess: false });
    expect(done.stockStatus).toBe("resolved");
  });

  it("takes the stock when a late 'paid' arrives for a checkout that was released, or flags it if the shelf is empty", async () => {
    const p = await makeProduct(w, { stock: 3, reserve: 1 });
    const token = await bagWith(w, p.id, 2);
    expect((await place(token, FORM, withProvider(declining))).ok).toBe(false);
    const [declined] = (await payload.find({ collection: "orders", where: { stockStatus: { equals: "released" }, "customer.email": { equals: CONTACT.email } }, sort: "-createdAt", limit: 1, depth: 0, overrideAccess: true })).docs;
    expect(declined.paymentStatus).toBe("failed");

    // The payment event arrives late and says paid.
    await payload.update({ collection: "orders", id: declined.id, data: { paymentStatus: "paid" }, user: w.manager, overrideAccess: false });
    expect((await reconcilePaidHeld(payload, NOW)).committed).toBeGreaterThanOrEqual(1);
    expect(await liveStock(payload, p.id)).toBe(1);
    expect((await order(declined.number)).stockStatus).toBe("committed");
    expect(await reconcilePaidHeld(payload, NOW)).toMatchObject({ checked: 0 }); // nothing left to do, and nothing moves twice
    expect(await liveStock(payload, p.id)).toBe(1);

    // The same again, but the shelf has been emptied in the meantime.
    const q = await makeProduct(w, { stock: 3, reserve: 1 });
    const token2 = await bagWith(w, q.id, 2);
    await place(token2, { ...FORM, name: "Late Buyer" }, withProvider(declining));
    const [late] = (await payload.find({ collection: "orders", where: { stockStatus: { equals: "released" }, "customer.name": { equals: "Late Buyer" } }, depth: 0, overrideAccess: true })).docs;
    await applyMovements(payload, [{ unit: { productId: String(q.id), variantKey: null }, mode: "count", amount: 0, reason: "count_correction", idempotencyKey: "late-empty" }], NOW);
    await payload.update({ collection: "orders", id: late.id, data: { paymentStatus: "paid" }, overrideAccess: true });
    expect(await reconcilePaidHeld(payload, NOW)).toMatchObject({ needsAttention: 1 });
    expect(await order(late.number)).toMatchObject({ paymentStatus: "paid", stockStatus: "needs_attention", fulfillmentStatus: "staff_review" });
  });
});

describe("cancelling never restocks; an explicit restock does", () => {
  async function paidOrder(stock: number, quantity: number, spec: Parameters<typeof makeProduct>[1] = {}) {
    const p = await makeProduct(w, { stock, ...spec });
    const result = await place(await bagWith(w, p.id, quantity), { ...FORM, name: `Cancel ${p.id}` });
    if (!result.ok) throw new Error(result.error);
    return { p, number: result.number, saved: await order(result.number) };
  }
  const restock = (data: Record<string, unknown>, user = w.manager) => payload.create({ collection: "stock-adjustments", data: { kind: "cancel_restock", note: "Customer cancelled", ...data } as never, user, overrideAccess: false });

  it("leaves the shelf alone when an order is cancelled or refunded", async () => {
    const { p, saved } = await paidOrder(10, 2);
    expect(await liveStock(payload, p.id)).toBe(8);
    await payload.update({ collection: "orders", id: saved.id, data: { fulfillmentStatus: "canceled" }, user: w.fulfillment, overrideAccess: false });
    await payload.update({ collection: "orders", id: saved.id, data: { paymentStatus: "refunded" }, user: w.manager, overrideAccess: false });
    expect(await liveStock(payload, p.id)).toBe(8);
    expect(await movementsFor(payload, p.id)).toHaveLength(1);
  });

  it("puts back the chosen components, once, up to what was taken, with a record of who and why", async () => {
    const { p, saved } = await paidOrder(10, 3);
    const done = await restock({ order: saved.id, restockLines: [{ product: p.id, quantity: 2 }] }, w.fulfillment);
    expect(await liveStock(payload, p.id)).toBe(9);
    expect(done).toMatchObject({ user: { id: w.fulfillment.id }, note: "Customer cancelled" });
    expect(done.result).toEqual([expect.objectContaining({ delta: 2, quantityAfter: 9 })]);
    const movements = await movementsFor(payload, p.id);
    expect(movements.map((m) => [m.reason, m.delta, m.reference])).toEqual([["sale", -3, saved.number], ["cancel_restock", 2, saved.number]]);
    expect(movements[1].user).toBe(w.fulfillment.id);

    await expect(restock({ order: saved.id, restockLines: [{ product: p.id, quantity: 2 }] })).rejects.toThrow(/Only 1/);
    expect(await liveStock(payload, p.id)).toBe(9);
    await restock({ order: saved.id, restockLines: [{ product: p.id, quantity: 1 }] });
    expect(await liveStock(payload, p.id)).toBe(10);
    await expect(restock({ order: saved.id, restockLines: [{ product: p.id, quantity: 1 }] })).rejects.toThrow(/already been put back/);
  });

  it("refuses things the order never took, and needs exactly one of order or reservation", async () => {
    const { saved } = await paidOrder(10, 1);
    const other = await makeProduct(w, { stock: 5 });
    await expect(restock({ order: saved.id, restockLines: [{ product: other.id, quantity: 1 }] })).rejects.toThrow(/not taken from stock/);
    await expect(restock({ restockLines: [{ product: other.id, quantity: 1 }] })).rejects.toThrow(/order or the reservation/);
  });

  it("refuses perishable items unless an owner or manager confirms they are fit to sell", async () => {
    const { p, saved } = await paidOrder(10, 2, { title: "Fresh fruit cup", perishable: true });
    const lines = [{ product: p.id, quantity: 1 }];
    await expect(restock({ order: saved.id, restockLines: lines }, w.fulfillment)).rejects.toThrow(/Only the owner or a manager/);
    await expect(restock({ order: saved.id, restockLines: lines, confirmPerishable: true }, w.fulfillment)).rejects.toThrow(/Only the owner or a manager/);
    await expect(restock({ order: saved.id, restockLines: lines })).rejects.toThrow(/Tick the confirmation/);
    expect(await liveStock(payload, p.id)).toBe(8);
    await restock({ order: saved.id, restockLines: lines, confirmPerishable: true }, w.owner);
    expect(await liveStock(payload, p.id)).toBe(9);
  });

  it("is atomic: one bad line puts nothing back", async () => {
    const a = await makeProduct(w, { stock: 10 });
    const b = await makeProduct(w, { stock: 10 });
    const token = newCartToken();
    await changeBag(payload, token, { unitId: String(a.id), quantity: 2, mode: "add" }, ctx);
    await changeBag(payload, token, { unitId: String(b.id), quantity: 1, mode: "add" }, ctx);
    const placed = await place(token, { ...FORM, name: "Two lines" });
    if (!placed.ok) throw new Error(placed.error);
    const saved = await order(placed.number);
    await expect(restock({ order: saved.id, restockLines: [{ product: a.id, quantity: 1 }, { product: b.id, quantity: 5 }] })).rejects.toThrow();
    expect(await liveStock(payload, a.id)).toBe(8);
    expect(await liveStock(payload, b.id)).toBe(9);
  });
});

describe("staff counts and adjustments (the product form's stock is read-only)", () => {
  const record = (data: Record<string, unknown>, user = w.manager) => payload.create({ collection: "stock-adjustments", data: { note: "Shelf count", ...data } as never, user, overrideAccess: false });

  it("lets the owner or a manager record a count and an adjustment, atomically with the ledger and outbox", async () => {
    const p = await makeProduct(w, { stock: null });
    const counted = await record({ kind: "count", product: p.id, countedQuantity: 14 });
    expect(counted.result).toEqual([expect.objectContaining({ delta: 14, quantityAfter: 14 })]);
    expect(await liveStock(payload, p.id)).toBe(14);
    const live = (await payload.findByID({ collection: "products", id: p.id, depth: 0, overrideAccess: true })) as Product;
    expect(live).toMatchObject({ stockState: "known" });
    expect(live.stockCountedAt).toEqual(expect.any(String));

    await record({ kind: "adjust", product: p.id, delta: -4, note: "Damaged in the back" }, w.owner);
    expect(await liveStock(payload, p.id)).toBe(10);
    await expect(record({ kind: "adjust", product: p.id, delta: -11 })).rejects.toThrow(/below zero/);
    expect(await liveStock(payload, p.id)).toBe(10);

    const movements = await movementsFor(payload, p.id);
    expect(movements.map((m) => [m.reason, m.delta, m.quantityAfter])).toEqual([["count_correction", 14, 14], ["manual_adjustment", -4, 10]]);
    const events = await payload.find({ collection: "outbox", where: { "payload.productId": { equals: p.id } }, depth: 0, overrideAccess: true });
    expect(events.totalDocs).toBe(2);
  });

  it("handles options, and checks the option code", async () => {
    const p = await makeProduct(w, { stock: null, variants: [{ key: "pink", stock: null }, { key: "blue", stock: null }] });
    await record({ kind: "count", product: p.id, variantKey: "pink", countedQuantity: 6 });
    expect(await liveStock(payload, p.id, "pink")).toBe(6);
    expect(await liveStock(payload, p.id, "blue")).toBeNull();
    await expect(record({ kind: "count", product: p.id, countedQuantity: 6 })).rejects.toThrow(/has options/);
    await expect(record({ kind: "count", product: p.id, variantKey: "green", countedQuantity: 6 })).rejects.toThrow(/has options/);
    const plain = await makeProduct(w, { stock: 1 });
    await expect(record({ kind: "count", product: plain.id, variantKey: "pink", countedQuantity: 6 })).rejects.toThrow(/no options/);
  });

  it("keeps counts and adjustments from fulfillment staff and from anyone signed out, and keeps rows immutable", async () => {
    const p = await makeProduct(w, { stock: 5 });
    await expect(record({ kind: "count", product: p.id, countedQuantity: 1 }, w.fulfillment)).rejects.toThrow(/owner or a manager/);
    await expect(payload.create({ collection: "stock-adjustments", data: { kind: "count", product: p.id, countedQuantity: 1, note: "x" } as never, overrideAccess: false })).rejects.toThrow();
    await expect(payload.create({ collection: "stock-adjustments", data: { kind: "count", product: p.id, countedQuantity: 1, note: "x" } as never, overrideAccess: true })).rejects.toThrow(/Sign in/);
    expect(await liveStock(payload, p.id)).toBe(5);
    const done = await record({ kind: "adjust", product: p.id, delta: 1 });
    await expect(payload.update({ collection: "stock-adjustments", id: done.id, data: { note: "changed" }, user: w.owner, overrideAccess: false })).rejects.toThrow();
    await expect(payload.delete({ collection: "stock-adjustments", id: done.id, user: w.owner, overrideAccess: false })).rejects.toThrow();
  });

  it("audits the adjustment", async () => {
    const p = await makeProduct(w, { stock: 5 });
    const done = await record({ kind: "adjust", product: p.id, delta: 2 });
    const audit = await payload.find({ collection: "audit-log", where: { and: [{ target: { equals: "stock-adjustments" } }, { targetId: { equals: String(done.id) } }] }, depth: 0, overrideAccess: true });
    expect(audit.docs).toHaveLength(1);
  });
});

describe("stale stock (INV 05)", () => {
  const HOURS = 3600_000;

  it("changes nothing until Lody sets a limit, then blocks a product or option counted too long ago", async () => {
    const old = await makeProduct(w, { stock: 5, countedAt: new Date(NOW.getTime() - 100 * HOURS).toISOString() });
    const never = await makeProduct(w, { stock: 5 });
    const add = (id: number) => changeBag(payload, newCartToken(), { unitId: String(id), quantity: 1, mode: "add" }, ctx);
    expect(await add(old.id)).toEqual({ ok: true });
    expect(await add(never.id)).toEqual({ ok: true });

    await payload.updateGlobal({ slug: "inventory-settings", data: { maxStockAgeHours: 48 }, user: w.manager, overrideAccess: false });
    const strict = await loadCheckoutContext(payload, { APP_ENV: "test" });
    expect(strict.inventory.maxAgeMs).toBe(48 * HOURS);
    const addNow = (id: number) => changeBag(payload, newCartToken(), { unitId: String(id), quantity: 1, mode: "add" }, strict);
    // changeBag reads the real clock, so use a count date relative to now for the passing case.
    const recent = await makeProduct(w, { stock: 5, countedAt: new Date().toISOString() });
    expect(await addNow(old.id)).toMatchObject({ ok: false });
    expect(await addNow(never.id)).toMatchObject({ ok: false });
    expect(await addNow(recent.id)).toEqual({ ok: true });

    // The shop's own pages read the same stock: a stale product is "Currently unavailable".
    const doc = (await payload.findByID({ collection: "products", id: old.id, depth: 0, overrideAccess: true })) as Product;
    const { applyInventoryView } = await import("@/src/lib/inventory/view");
    const seen = (await applyInventoryView(payload, [doc], { now: NOW, config: strict.inventory })).products[0];
    expect(sellableUnits(seen)[0].availability).toMatchObject({ status: "unavailable", label: "Currently unavailable" });

    // A staff count renews it.
    await payload.create({ collection: "stock-adjustments", data: { kind: "count", product: old.id, countedQuantity: 5, note: "Recounted" } as never, user: w.manager, overrideAccess: false });
    expect(await addNow(old.id)).toEqual({ ok: true });

    // Switching the limit off again restores the old behaviour.
    await payload.updateGlobal({ slug: "inventory-settings", data: { maxStockAgeHours: null }, user: w.manager, overrideAccess: false });
    const lax = await loadCheckoutContext(payload, { APP_ENV: "test" });
    expect(lax.inventory.maxAgeMs).toBeNull();
    expect(await add(never.id)).toEqual({ ok: true });
  });

  it("keeps the builder from offering stale products, as 'stale' stock", async () => {
    await payload.updateGlobal({ slug: "inventory-settings", data: { maxStockAgeHours: 48 }, overrideAccess: true });
    const p = await makeProduct(w, { stock: 5, basketEligible: true, countedAt: "2026-01-01T00:00:00.000Z" });
    await payload.update({ collection: "products", id: p.id, data: { giftTypes: ["sweet"] }, overrideAccess: true });
    const catalog = await loadBuilderCatalogFrom(payload, { now: NOW });
    expect(catalog.products.find((x) => x.id === String(p.id))?.stock).toEqual({ state: "stale" });
    await payload.updateGlobal({ slug: "inventory-settings", data: { maxStockAgeHours: null }, overrideAccess: true });
    expect((await loadBuilderCatalogFrom(payload, { now: NOW })).products.find((x) => x.id === String(p.id))?.stock).toMatchObject({ state: "known" });
  });
});

describe("order numbers (A02)", () => {
  it("never reuse or collide after an early order is deleted", async () => {
    const p = await makeProduct(w, { stock: 50, reserve: 0 });
    const numbers: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await place(await bagWith(w, p.id), { ...FORM, name: `Numbered ${i}` });
      if (!r.ok) throw new Error(r.error);
      numbers.push(r.number);
    }
    expect(new Set(numbers).size).toBe(3);
    const earliest = await order(numbers[0]);
    await payload.delete({ collection: "orders", id: earliest.id, user: w.owner, overrideAccess: false });
    const more: string[] = [];
    for (let i = 3; i < 5; i++) {
      const r = await place(await bagWith(w, p.id), { ...FORM, name: `Numbered ${i}` });
      if (!r.ok) throw new Error(`order ${i} failed: ${r.error}`);
      more.push(r.number);
    }
    const all = [...numbers.slice(1), ...more];
    expect(new Set(all).size).toBe(4);
    const highest = (list: string[]) => Math.max(...list.map((n) => Number(n.split("-")[1])));
    expect(highest(more)).toBeGreaterThan(highest(numbers));
  });

  it("copes with two simultaneous orders after a deletion", async () => {
    const p = await makeProduct(w, { stock: 50, reserve: 0 });
    const results = await Promise.all([1, 2, 3].map(async (i) => place(await bagWith(w, p.id), { ...FORM, name: `Parallel ${i}` })));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(new Set(results.map((r) => (r.ok ? r.number : ""))).size).toBe(3);
  });
});

describe("the staging 'assume stock' aid", () => {
  const original = process.env.PREVIEW_ASSUME_STOCK;
  afterAll(() => {
    if (original === undefined) delete process.env.PREVIEW_ASSUME_STOCK;
    else process.env.PREVIEW_ASSUME_STOCK = original;
  });

  it("lets uncounted stock be ordered on staging without writing the ledger", async () => {
    process.env.PREVIEW_ASSUME_STOCK = "true";
    const staging = await loadCheckoutContext(payload, { APP_ENV: "staging", PREVIEW_ASSUME_STOCK: "true" });
    expect(staging.inventory.assumeUnknown).toBe(true);
    const p = await makeProduct(w, { stock: null });
    const token = newCartToken();
    expect(await changeBag(payload, token, { unitId: String(p.id), quantity: 1, mode: "add" }, staging)).toEqual({ ok: true });
    const result = await placeOrder(payload, { cartToken: token, form: FORM, now: NOW }, staging);
    expect(result.ok).toBe(true);
    expect(await movementsFor(payload, p.id)).toEqual([]);
    delete process.env.PREVIEW_ASSUME_STOCK;
  });
});

describe("custom basket reservations (D36)", () => {
  let draft: BasketDraft;
  let items: Product[];

  beforeAll(async () => {
    items = [];
    for (let i = 0; i < 7; i++) {
      const item = await makeProduct(w, { title: `Basket item ${i}`, stock: 5, reserve: 1, priceCents: 300, basketEligible: true });
      await payload.update({ collection: "products", id: item.id, data: { giftTypes: ["sweet"] }, overrideAccess: true });
      items.push(item);
    }
    draft = {
      request: { kind: "custom", size: "small", giftType: "sweet", budgetCents: null, selections: items.slice(0, 6).map((p) => ({ productId: String(p.id), quantity: 1 })) },
      message: "Happy birthday",
      requests: "",
    };
  });

  const reserve = (d: BasketDraft, form: Record<string, unknown> = { ...FORM, pickup: "2026-10-08|11:00", payment: "deposit" }, c = ctx) => reserveBasket(payload, { draft: d, form, now: NOW }, c);

  it("deducts each snapshot component once, and a double submit is one reservation", async () => {
    const [a, b] = await Promise.all([reserve(draft), reserve(draft)]);
    expect(a).toEqual(b);
    if (!a.ok) throw new Error(a.error);
    for (const p of items.slice(0, 6)) expect(await liveStock(payload, p.id)).toBe(4);
    expect(await liveStock(payload, items[6].id)).toBe(5);
    const saved = (await findByToken(payload, "reservations", a.number, a.token)) as Reservation;
    expect(saved).toMatchObject({ paymentStatus: "deposit_paid", stockStatus: "committed" });
    expect(saved.stockPlan).toHaveLength(6);
    expect((await movementsFor(payload, items[0].id)).map((m) => [m.reason, m.delta, m.reference])).toEqual([["reservation", -1, a.number]]);
  });

  it("holds, then releases on a declined deposit", async () => {
    const before = await liveStock(payload, items[0].id);
    const result = await reserve({ ...draft, message: "Declined one" }, { ...FORM, name: "Decliner", pickup: "2026-10-08|12:00", payment: "deposit" }, withProvider(declining));
    expect(result).toMatchObject({ ok: false });
    expect(await liveStock(payload, items[0].id)).toBe(before);
    const rows = await payload.find({ collection: "stock-holds", where: { owner: { like: "basket:" }, status: { equals: "active" } }, depth: 0, overrideAccess: true });
    expect(rows.docs).toEqual([]);
  });

  it("builds components from the merged, validated selections (A01)", async () => {
    // A crafted request: item 0 three times and then minus two = one, as validation counts it.
    const crafted: BasketDraft = {
      ...draft,
      request: { ...draft.request, selections: [{ productId: String(items[0].id), quantity: 3 }, { productId: String(items[0].id), quantity: -2 }, ...draft.request.selections.slice(1)] },
    };
    const priced = await priceBasket(payload, crafted, ctx, { now: NOW });
    if (!priced.ok) throw new Error(priced.error);
    expect(priced.components.find((c) => c.productId === String(items[0].id))?.quantity).toBe(1);
    expect(priced.components.reduce((n, c) => n + c.quantity, 0)).toBe(6);
    expect(priced.plan.reduce((n, l) => n + l.quantity, 0)).toBe(6);
  });

  it("refuses a basket when a component has been held by someone else", async () => {
    const scarce = items[6];
    await payload.update({ collection: "products", id: scarce.id, data: { stockQuantity: 2 }, overrideAccess: true }); // one sellable
    const withScarce: BasketDraft = { ...draft, request: { ...draft.request, selections: [...draft.request.selections.slice(0, 5), { productId: String(scarce.id), quantity: 1 }] } };
    const [first, second] = await Promise.all([
      reserve(withScarce, { ...FORM, name: "First", pickup: "2026-10-08|13:00", payment: "deposit" }),
      reserve(withScarce, { ...FORM, name: "Second", email: "second@example.test", pickup: "2026-10-08|13:00", payment: "deposit" }),
    ]);
    expect([first.ok, second.ok].sort()).toEqual([false, true]);
    expect(await liveStock(payload, scarce.id)).toBe(1);
  });

  it("is seen by the builder with other customers' holds taken off", async () => {
    const catalog = await loadBuilderCatalogFrom(payload, { now: NOW });
    const counted = (await liveStock(payload, items[1].id))!;
    expect(catalog.products.find((p) => p.id === String(items[1].id))?.stock).toEqual({ state: "known", quantity: counted - 1 }); // minus the in-store reserve
  });
});


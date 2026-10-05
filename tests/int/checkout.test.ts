/**
 * Milestone 4 end to end against a real Payload instance: bag → order, basket → reservation with
 * deposit, idempotency, immutable snapshots and staff permissions (D35, D36).
 */
import type { Payload } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

import type { Product, User } from "@/payload-types";
import { loadCatalogSeed, seedCatalog } from "@/src/lib/catalog/seed";
import {
  changeBag,
  findByToken,
  loadCheckoutContext,
  newCartToken,
  placeOrder,
  priceBag,
  reserveBasket,
  type BasketDraft,
  type CheckoutContext,
} from "@/src/lib/checkout/service";
import { importSourceRecords } from "@/src/lib/source-import";
import { readSourceRows } from "@/src/lib/source-files";

import { getTestPayload } from "./payload-instance";

const FORBIDDEN = /not allowed to perform this action/i;
// Monday 2026-10-05, 10:00 in Plymouth.
const NOW = new Date("2026-10-05T14:00:00Z");
const CONTACT = { name: "Pat Customer", email: "pat@example.test", phone: "(508) 555-0100" };

let payload: Payload;
let ctx: CheckoutContext;
let manager: User;
let fulfillment: User;

async function bySlug(slug: string): Promise<Product> {
  return (await payload.find({ collection: "products", where: { slug: { equals: slug } }, overrideAccess: true, depth: 0 })).docs[0] as Product;
}

async function stock(slug: string, quantity: number) {
  const p = await bySlug(slug);
  await payload.update({ collection: "products", id: p.id, data: { stockState: "known", stockQuantity: quantity }, overrideAccess: true });
  return p;
}

beforeAll(async () => {
  payload = await getTestPayload();
  const make = (email: string, roles: User["roles"]) =>
    payload.create({ collection: "users", data: { email, password: "test-password-123", roles }, overrideAccess: true });
  await make("lody@example.test", ["owner"]);
  manager = await make("faisal@example.test", ["manager"]);
  fulfillment = await make("staff@example.test", ["fulfillment"]);
  await importSourceRecords(payload, readSourceRows());
  const { seed, allergens, assetsDir } = loadCatalogSeed();
  await seedCatalog(payload, seed, allergens, assetsDir);
  ctx = await loadCheckoutContext(payload, { APP_ENV: "test" });
});

describe("tax class seed (D34)", () => {
  it("starts with Clover's 6.25% as the unapproved default", () => {
    expect(ctx.taxClasses).toEqual([expect.objectContaining({ rateBasisPoints: 625, approved: false })]);
    expect(ctx.defaultTaxClassId).toBe(ctx.taxClasses[0].id);
    expect(ctx.packagingTaxClassId).toBe(ctx.taxClasses[0].id);
  });
});

describe("bag and order (D35)", () => {
  it("only accepts products that can be bought, and clamps to sellable stock", async () => {
    const token = newCartToken();
    const bar = await stock("phillips-smores-bar", 4); // reserve 1 → 3 sellable
    expect(await changeBag(payload, token, { unitId: String(bar.id), quantity: 5, mode: "add" }, ctx)).toEqual({ ok: true });
    const bag = await priceBag(payload, token, ctx);
    expect(bag.payable).toEqual([expect.objectContaining({ title: "Phillips Chocolate S'mores Bar", quantity: 3, unitPriceCents: 425 })]);

    const unknown = await bySlug("teddy-bear"); // stock never counted
    expect(await changeBag(payload, token, { unitId: String(unknown.id), quantity: 1, mode: "add" }, ctx)).toMatchObject({ ok: false });
  });

  it("places a test order with an immutable snapshot, once, and clears the bag", async () => {
    const token = newCartToken();
    const bar = await stock("phillips-dark-chocolate-bar", 10);
    await changeBag(payload, token, { unitId: String(bar.id), quantity: 2, mode: "add" }, ctx);
    const form = { ...CONTACT, pickup: "2026-10-06|11:00", notes: "Gift wrap please" };

    const first = await placeOrder(payload, { cartToken: token, form, now: NOW }, ctx);
    expect(first).toMatchObject({ ok: true, number: expect.stringMatching(/^SP-\d+$/) });
    if (!first.ok) throw new Error(first.error);

    const order = await findByToken(payload, "orders", first.number, first.token);
    expect(order).toMatchObject({
      paymentStatus: "paid",
      fulfillmentStatus: "preparing",
      testMode: true,
      customer: CONTACT,
      pickup: { date: "2026-10-06", start: "11:00", end: "12:00", label: "Tuesday, October 6, 11:00 AM–12:00 PM" },
      totals: { subtotalCents: 850, taxCents: 53, totalCents: 903, taxApproved: false },
    });
    expect(await findByToken(payload, "orders", first.number, "wrong-token")).toBeNull();
    expect((await priceBag(payload, token, ctx)).payable).toEqual([]);

    // A price edit later never changes what was bought.
    await payload.update({ collection: "products", id: bar.id, data: { priceCents: 999 }, overrideAccess: true });
    const again = await findByToken(payload, "orders", first.number, first.token);
    expect((again!.lines as { unitPriceCents: number }[])[0].unitPriceCents).toBe(425);
  });

  it("treats a double submit as one order", async () => {
    const token = newCartToken();
    const bar = await stock("phillips-milk-chocolate-bar", 10);
    await changeBag(payload, token, { unitId: String(bar.id), quantity: 1, mode: "add" }, ctx);
    const form = { ...CONTACT, pickup: "2026-10-06|12:00" };
    const [a, b] = await Promise.all([placeOrder(payload, { cartToken: token, form, now: NOW }, ctx), placeOrder(payload, { cartToken: token, form, now: NOW }, ctx)]);
    expect(a).toEqual(b);
    const { totalDocs } = await payload.count({ collection: "orders", where: { "customer.email": { equals: CONTACT.email }, "pickup.start": { equals: "12:00" } }, overrideAccess: true });
    expect(totalDocs).toBe(1);
  });

  it("refuses bad pickup times and contact details", async () => {
    const token = newCartToken();
    const bar = await stock("phillips-smores-bar", 10);
    await changeBag(payload, token, { unitId: String(bar.id), quantity: 1, mode: "add" }, ctx);
    expect(await placeOrder(payload, { cartToken: token, form: { ...CONTACT, pickup: "2026-10-05|15:00" }, now: NOW }, ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/pickup time/) });
    expect(await placeOrder(payload, { cartToken: token, form: { ...CONTACT, email: "nope", pickup: "2026-10-06|11:00" }, now: NOW }, ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/email/) });
  });

  it("can't place orders without a payment provider (production)", async () => {
    const live = await loadCheckoutContext(payload, { APP_ENV: "production" });
    expect(await placeOrder(payload, { cartToken: newCartToken(), form: CONTACT, now: NOW }, live)).toMatchObject({ ok: false, error: expect.stringMatching(/coming soon/) });
  });
});

describe("basket reservations (D36)", () => {
  let draft: BasketDraft;

  beforeAll(async () => {
    // Count stock on every basket-eligible product so a small basket can be completed.
    const eligible = await payload.find({ collection: "products", where: { basketEligible: { equals: true } }, limit: 100, depth: 0, overrideAccess: true });
    for (const p of eligible.docs) {
      await payload.update({ collection: "products", id: p.id, data: { stockState: "known", stockQuantity: 10, variants: (p.variants ?? []).map((v) => ({ ...v, stockState: "known" as const, stockQuantity: 10 })) }, overrideAccess: true });
    }
    const sweet = (premium: boolean) =>
      payload.find({ collection: "products", where: { and: [{ basketEligible: { equals: true } }, { _status: { equals: "published" } }, { priceApproved: { equals: true } }, { premium: { equals: premium } }, { exclusiveTo: { exists: false } }, { giftTypes: { contains: "sweet" } }] }, limit: 20, depth: 0, overrideAccess: true });
    // A small basket: 6 items, at most 1 premium (Phillips) — the catalog has 5 plain sweet items today.
    const picks = [...(await sweet(false)).docs.slice(0, 5), ...(await sweet(true)).docs.slice(0, 1)];
    expect(picks).toHaveLength(6);
    draft = {
      request: { kind: "custom", size: "small", giftType: "sweet", budgetCents: null, selections: picks.map((p) => ({ productId: p.variants?.length ? `${p.id}:${p.variants[0].key}` : String(p.id), quantity: 1 })) },
      message: "Happy birthday, Sam!",
      requests: "",
    };
  });

  it("takes the percentage deposit, records the balance, and writes assembly instructions", async () => {
    const result = await reserveBasket(payload, { draft, form: { ...CONTACT, pickup: "2026-10-08|11:00", payment: "deposit" }, now: NOW }, ctx);
    expect(result).toMatchObject({ ok: true, number: expect.stringMatching(/^SPR-\d+$/) });
    if (!result.ok) throw new Error(result.error);
    const r = await findByToken(payload, "reservations", result.number, result.token);
    expect(r).toMatchObject({ paymentStatus: "deposit_paid", reservationStatus: "confirmed", testMode: true });
    expect(r!.depositCents).toBe(Math.floor((r!.totalCents * 2500 + 5000) / 10000));
    expect(r!.amountPaidCents + r!.balanceDueCents).toBe(r!.totalCents);
    expect(r!.assembly).toMatch(/^Sweet basket — Small — 12" basket\n• 1 × /);
    expect(r!.assembly).toContain('Gift message: "Happy birthday, Sam!"');
  });

  it("uses a flat deposit, allows paying in full, and sends requests to staff review", async () => {
    await payload.updateGlobal({ slug: "checkout-settings", data: { depositType: "flat", depositFlatCents: 2000 }, user: manager, overrideAccess: false });
    const flat = await loadCheckoutContext(payload, { APP_ENV: "test" });
    const deposit = await reserveBasket(payload, { draft, form: { ...CONTACT, pickup: "2026-10-08|12:00", payment: "deposit" }, now: NOW }, flat);
    if (!deposit.ok) throw new Error(deposit.error);
    expect(await findByToken(payload, "reservations", deposit.number, deposit.token)).toMatchObject({ amountPaidCents: 2000 });

    const full = await reserveBasket(payload, { draft: { ...draft, requests: "No nuts please" }, form: { ...CONTACT, pickup: "2026-10-08|13:00", payment: "full" }, now: NOW }, flat);
    if (!full.ok) throw new Error(full.error);
    const r = await findByToken(payload, "reservations", full.number, full.token);
    expect(r).toMatchObject({ paymentStatus: "paid_in_full", balanceDueCents: 0, reservationStatus: "staff_review" });
    expect(r!.amountPaidCents).toBe(r!.totalCents);

    await payload.updateGlobal({ slug: "checkout-settings", data: { allowPayInFull: false }, overrideAccess: true });
    const noFull = await loadCheckoutContext(payload, { APP_ENV: "test" });
    expect(await reserveBasket(payload, { draft, form: { ...CONTACT, pickup: "2026-10-08|14:00", payment: "full" }, now: NOW }, noFull)).toMatchObject({ ok: false });
  });

  it("refuses an incomplete basket and pickups inside the 48-hour notice", async () => {
    const short = { ...draft, request: { ...draft.request, selections: draft.request.selections.slice(0, 2) } };
    expect(await reserveBasket(payload, { draft: short, form: { ...CONTACT, pickup: "2026-10-08|11:00" }, now: NOW }, ctx)).toMatchObject({ ok: false });
    expect(await reserveBasket(payload, { draft, form: { ...CONTACT, pickup: "2026-10-06|15:00" }, now: NOW }, ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/pickup time/) });
  });
});

describe("staff permissions (OPS 01–02)", () => {
  it("hides orders, reservations and bags from the public", async () => {
    for (const collection of ["orders", "reservations", "carts"] as const) {
      await expect(payload.find({ collection, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    }
  });

  it("lets fulfillment staff move an order along but not touch payment or the snapshot", async () => {
    const order = (await payload.find({ collection: "orders", limit: 1, overrideAccess: true })).docs[0];
    const moved = await payload.update({ collection: "orders", id: order.id, data: { fulfillmentStatus: "ready", paymentStatus: "refunded", totals: { ...order.totals, totalCents: 1 } }, user: fulfillment, overrideAccess: false });
    expect(moved).toMatchObject({ fulfillmentStatus: "ready", paymentStatus: order.paymentStatus, totals: { totalCents: order.totals.totalCents } });

    const refunded = await payload.update({ collection: "orders", id: order.id, data: { paymentStatus: "refunded" }, user: manager, overrideAccess: false });
    expect(refunded.paymentStatus).toBe("refunded");
    const audit = await payload.find({ collection: "audit-log", where: { and: [{ target: { equals: "orders" } }, { targetId: { equals: String(order.id) } }] }, overrideAccess: true });
    expect(audit.docs.flatMap((d) => d.changes as { field: string }[]).map((c) => c.field)).toEqual(expect.arrayContaining(["fulfillmentStatus", "paymentStatus"]));
  });
});

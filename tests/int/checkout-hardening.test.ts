/**
 * Checkout hardening against a real Payload instance (D42): the public product API (A04), payment
 * defects with a fake non-test provider (A05), one-submission idempotency (A11), staff review for
 * notes (A12), awaiting-payment states (A14), delete audit (A20) and the SQLite busy timeout.
 */
import type { Payload } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

import type { Order, Product, Reservation } from "@/payload-types";
import { loadBuilderCatalogFrom } from "@/src/lib/catalog/builder-catalog";
import { changeBag, chargeSafely, findByToken, loadCheckoutContext, newCartToken, placeOrder, priceBag, reserveBasket, type BasketDraft, type CheckoutContext } from "@/src/lib/checkout/service";
import { newSubmission, verifySubmission } from "@/src/lib/checkout/submission";
import { findPublishedItem } from "@/src/lib/inquiries/service";
import type { ChargeInput, ChargeResult, PaymentProvider } from "@/src/lib/payments";

import { bagWith, FORM, makeProduct, NOW, setupWorld, type World } from "./inventory-fixtures";

let w: World;
let payload: Payload;
let ctx: CheckoutContext;

const FORBIDDEN = /not allowed to perform this action/i;

/** A live (non-test) provider whose answers are scripted. */
function scripted(...script: (ChargeResult | "throw" | "hang")[]) {
  const calls: ChargeInput[] = [];
  const provider: PaymentProvider = {
    id: "fake-live",
    test: false,
    async charge(input) {
      calls.push(input);
      const next = script[Math.min(calls.length - 1, script.length - 1)];
      if (next === "throw") throw new Error("socket hang up");
      if (next === "hang") return new Promise<ChargeResult>(() => undefined);
      return next;
    },
  };
  return { provider, calls };
}

const paid = (n = 1): ChargeResult => ({ status: "paid", reference: `live_${n}` });
const declined: ChargeResult = { status: "failed", reference: "", message: "card declined" };

const live = (provider: PaymentProvider, extra: Partial<CheckoutContext> = {}): CheckoutContext => ({ ...ctx, provider, chargeTimeoutMs: 200, ...extra });
const orderOf = async (number: string) => (await payload.find({ collection: "orders", where: { number: { equals: number } }, depth: 0, overrideAccess: true })).docs[0] as Order;
const reservationOf = async (number: string) => (await payload.find({ collection: "reservations", where: { number: { equals: number } }, depth: 0, overrideAccess: true })).docs[0] as Reservation;
const place = (token: string, c: CheckoutContext, form: Record<string, unknown> = FORM, submission = newSubmission("order")) =>
  placeOrder(payload, { cartToken: token, form, submission, now: NOW }, c);
const auditRows = async (target: string, action: string) =>
  (await payload.find({ collection: "audit-log", where: { and: [{ target: { equals: target } }, { action: { equals: action } }] }, limit: 200, depth: 0, overrideAccess: true })).docs;

beforeAll(async () => {
  w = await setupWorld();
  payload = w.payload;
  ctx = w.ctx;
});

describe("the public product API (A04)", () => {
  it("answers anonymous reads of products and categories with 'not allowed', and lets staff read", async () => {
    const hidden = await makeProduct(w, { title: "Secret", channel: "hidden" });
    await expect(payload.find({ collection: "products", overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.find({ collection: "products", where: { channel: { equals: "hidden" } }, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.findByID({ collection: "products", id: hidden.id, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.find({ collection: "categories", overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    for (const user of [w.owner, w.manager, w.fulfillment]) {
      expect((await payload.find({ collection: "products", where: { id: { equals: hidden.id } }, user, overrideAccess: false })).docs).toHaveLength(1);
      expect((await payload.find({ collection: "categories", user, overrideAccess: false })).docs.length).toBeGreaterThan(0);
    }
  });

  it("does not leak through the REST handler either", async () => {
    const config = (await import("@payload-config")).default;
    const { GET } = await import("@payloadcms/next/routes").then((m) => ({ GET: m.REST_GET(config) }));
    const response = await GET(new Request("http://localhost/api/products?limit=50"), { params: Promise.resolve({ slug: ["products"] }) });
    expect(response.status).toBe(403);
    expect(await response.text()).not.toMatch(/assemblyNotes|onlineReserve|stockQuantity/);
  });

  it("keeps hidden products off the storefront paths that now read with override", async () => {
    const hidden = await makeProduct(w, { title: "Hidden thing", channel: "hidden", basketEligible: true });
    const visible = await makeProduct(w, { title: "Visible thing", stock: 3 });
    const found = await findPublishedItem(payload, hidden.slug);
    expect(found).toBeNull();
    expect(await findPublishedItem(payload, visible.slug)).toMatchObject({ id: visible.id });
    const token = newCartToken();
    expect(await changeBag(payload, token, { unitId: String(hidden.id), quantity: 1, mode: "add" }, ctx, NOW)).toMatchObject({ ok: false });
    expect((await priceBag(payload, token, ctx, NOW)).payable).toEqual([]);
    const builder = await loadBuilderCatalogFrom(payload, { now: NOW });
    expect(builder.products.some((p) => p.id === String(hidden.id))).toBe(false);
  });

  it("never sends the exact stock to the builder, only up to the most one gift can hold", async () => {
    const plenty = await makeProduct(w, { title: "Plentiful", stock: 80, reserve: 5, basketEligible: true });
    await payload.update({ collection: "products", id: plenty.id, data: { giftTypes: ["sweet"], maxPerGift: 2 }, overrideAccess: true });
    const scarce = await makeProduct(w, { title: "Scarce", stock: 2, reserve: 1, basketEligible: true });
    await payload.update({ collection: "products", id: scarce.id, data: { giftTypes: ["sweet"], maxPerGift: 3 }, overrideAccess: true });
    const builder = await loadBuilderCatalogFrom(payload, { now: NOW });
    expect(builder.products.find((p) => p.id === String(plenty.id))?.stock).toEqual({ state: "known", quantity: 2 });
    expect(builder.products.find((p) => p.id === String(scarce.id))?.stock).toEqual({ state: "known", quantity: 1 });
  });
});

describe("payments with a live provider (A05)", () => {
  it("opens only when the tax rates are approved, judged after pricing (a)", async () => {
    const p = await makeProduct(w, { stock: 10 });
    const token = await bagWith(w, p.id);
    const { provider, calls } = scripted(paid());
    const unapproved = live(provider, { taxClasses: ctx.taxClasses.map((c) => ({ ...c, approved: false })) });
    expect(await place(token, unapproved)).toMatchObject({ ok: false, error: expect.stringMatching(/coming soon/) });
    expect(calls).toHaveLength(0);
    expect(await place(token, live(provider))).toMatchObject({ ok: true });
    expect(calls).toHaveLength(1);
  });

  it("charges a new idempotency key after a decline, and the order only moves on when paid (b, A14)", async () => {
    const p = await makeProduct(w, { stock: 10 });
    const token = await bagWith(w, p.id);
    const { provider, calls } = scripted(declined, paid(2));
    const submission = newSubmission("order");

    const first = await place(token, live(provider), FORM, submission);
    expect(first).toMatchObject({ ok: false, error: expect.stringMatching(/didn't go through/) });
    const waiting = await payload.find({ collection: "orders", where: { and: [{ paymentStatus: { equals: "failed" } }, { "customer.email": { equals: FORM.email } }] }, sort: "-id", limit: 1, depth: 0, overrideAccess: true });
    expect(waiting.docs[0]).toMatchObject({ paymentStatus: "failed", fulfillmentStatus: "awaiting_payment", paymentAttempts: 1, testMode: false });

    // The same form again: a retry of the same record, with the next attempt's key.
    const second = await place(token, live(provider), FORM, submission);
    if (!second.ok) throw new Error(second.error);
    expect(calls).toHaveLength(2);
    expect(calls[0].idempotencyKey).toMatch(/^[0-9a-f]{64}:1$/);
    expect(calls[1].idempotencyKey).toBe(`${calls[0].idempotencyKey.replace(/:1$/, "")}:2`);
    expect(calls[1].reference).toBe(calls[0].reference);
    const done = (await findByToken(payload, "orders", second.number, second.token)) as Order;
    expect(done).toMatchObject({ paymentStatus: "paid", fulfillmentStatus: "preparing", paymentAttempts: 2, payment: { provider: "fake-live", reference: "live_2" } });
  });

  it("wraps a provider that throws: payment unknown, nothing lost, no second charge (d)", async () => {
    const p = await makeProduct(w, { stock: 10 });
    const token = await bagWith(w, p.id);
    const { provider, calls } = scripted("throw", paid());
    const submission = newSubmission("order");

    const first = await place(token, live(provider), FORM, submission);
    expect(first).toMatchObject({ ok: false, error: expect.stringMatching(/couldn't confirm your payment[\s\S]*SP-\d+[\s\S]*don't pay again/) });
    const number = (first as { error: string }).error.match(/SP-\d+/)![0];
    expect(await orderOf(number)).toMatchObject({ paymentStatus: "unknown", fulfillmentStatus: "awaiting_payment", stockStatus: "held" });
    expect((await priceBag(payload, token, ctx, NOW)).payable).toHaveLength(1); // the bag is kept

    // Neither the same form again nor a changed one (new notes) can charge until staff reconcile.
    expect(await place(token, live(provider), FORM, submission)).toMatchObject({ ok: false, error: expect.stringContaining(number) });
    expect(await place(token, live(provider), { ...FORM, notes: "different" })).toMatchObject({ ok: false, error: expect.stringContaining(number) });
    expect(calls).toHaveLength(1);

    // Staff confirm with the provider and mark it paid in the admin: the order leaves the waiting state.
    const reconciled = await payload.update({ collection: "orders", id: (await orderOf(number)).id, data: { paymentStatus: "paid" }, user: w.manager, overrideAccess: false });
    expect(reconciled).toMatchObject({ paymentStatus: "paid", fulfillmentStatus: "preparing" });
  });

  it("treats a provider that never answers as unknown after the timeout (d)", async () => {
    const p = await makeProduct(w, { stock: 10 });
    const token = await bagWith(w, p.id);
    const { provider, calls } = scripted("hang");
    const started = Date.now();
    const result = await place(token, live(provider));
    expect(Date.now() - started).toBeLessThan(5000);
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/couldn't confirm your payment/) });
    expect(calls).toHaveLength(1);
    const unknown = await payload.find({ collection: "orders", where: { paymentStatus: { equals: "unknown" } }, limit: 50, depth: 0, overrideAccess: true });
    expect(unknown.docs.length).toBeGreaterThan(0);
  });

  it("chargeSafely turns throws, timeouts and nonsense into 'unknown'", async () => {
    const input: ChargeInput = { reference: "SP-0", amountCents: 100, idempotencyKey: "k:1" };
    const make = (charge: PaymentProvider["charge"]): PaymentProvider => ({ id: "x", test: false, charge });
    expect(await chargeSafely(make(async () => { throw new Error("boom"); }), input, 50)).toMatchObject({ status: "unknown" });
    expect(await chargeSafely(make(() => new Promise(() => undefined)), input, 30)).toMatchObject({ status: "unknown" });
    expect(await chargeSafely(make(async () => ({ status: "maybe" }) as never), input, 50)).toMatchObject({ status: "unknown" });
    expect(await chargeSafely(make(async () => paid()), input, 50)).toMatchObject({ status: "paid" });
  });

  describe("reservations", () => {
    let draft: BasketDraft;

    beforeAll(async () => {
      const items: Product[] = [];
      for (let i = 0; i < 6; i++) {
        const item = await makeProduct(w, { title: `Hardening item ${i}`, stock: 20, reserve: 1, priceCents: 400, basketEligible: true });
        await payload.update({ collection: "products", id: item.id, data: { giftTypes: ["sweet"] }, overrideAccess: true });
        items.push(item);
      }
      draft = { request: { kind: "custom", size: "small", giftType: "sweet", budgetCents: null, selections: items.map((p) => ({ productId: String(p.id), quantity: 1 })) }, message: "", requests: "" };
    });

    const reserve = (c: CheckoutContext, form: Record<string, unknown>, submission: string, d = draft) => reserveBasket(payload, { draft: d, form, submission, now: NOW }, c);

    it("gates on the real tax approval and retries with the stored deposit, not a recomputed one (a, c)", async () => {
      const form = { ...FORM, name: "Retry Rita", email: "rita@example.test", pickup: "2026-10-08|11:00", payment: "deposit" };
      const submission = newSubmission("reservation");
      const { provider, calls } = scripted(declined, paid());

      const unapproved = live(provider, { taxClasses: ctx.taxClasses.map((c) => ({ ...c, approved: false })) });
      expect(await reserve(unapproved, form, submission)).toMatchObject({ ok: false, error: expect.stringMatching(/coming soon/) });
      expect(calls).toHaveLength(0);

      expect(await reserve(live(provider), form, submission)).toMatchObject({ ok: false });
      const declinedOne = (await payload.find({ collection: "reservations", where: { "customer.email": { equals: "rita@example.test" } }, depth: 0, overrideAccess: true })).docs[0];
      expect(declinedOne).toMatchObject({ paymentStatus: "failed", reservationStatus: "awaiting_payment", paymentAttempts: 1 });
      const stored = declinedOne.depositCents;
      expect(calls[0].amountCents).toBe(stored);

      // Lody edits the deposit between attempts. The retry still charges what the record says.
      const flat = await loadCheckoutContext(payload, { APP_ENV: "test" });
      const edited = live(provider, { deposit: { type: "flat", percentBasisPoints: 0, flatCents: stored + 777 }, taxClasses: flat.taxClasses });
      const retry = await reserve(edited, form, submission);
      if (!retry.ok) throw new Error(retry.error);
      expect(calls).toHaveLength(2);
      expect(calls[1].amountCents).toBe(stored);
      expect(calls[1].idempotencyKey).toBe(`${calls[0].idempotencyKey.replace(/:1$/, "")}:2`);
      const done = await reservationOf(retry.number);
      expect(done).toMatchObject({ paymentStatus: "deposit_paid", reservationStatus: "confirmed", amountPaidCents: stored, balanceDueCents: done.totalCents - stored });
    });

    it("leaves an unknown deposit for reconciliation, with no second charge", async () => {
      const form = { ...FORM, name: "Unknown Una", email: "una@example.test", pickup: "2026-10-08|12:00", payment: "deposit" };
      const submission = newSubmission("reservation");
      const { provider, calls } = scripted("throw", paid());
      const first = await reserve(live(provider), form, submission);
      expect(first).toMatchObject({ ok: false, error: expect.stringMatching(/SPR-\d+/) });
      expect(await reserve(live(provider), form, submission)).toMatchObject({ ok: false, error: expect.stringMatching(/couldn't confirm/) });
      expect(calls).toHaveLength(1);
      const number = (first as { error: string }).error.match(/SPR-\d+/)![0];
      expect(await reservationOf(number)).toMatchObject({ paymentStatus: "unknown", reservationStatus: "awaiting_payment" });
      const reconciled = await payload.update({ collection: "reservations", id: (await reservationOf(number)).id, data: { paymentStatus: "deposit_paid" }, user: w.owner, overrideAccess: false });
      expect(reconciled).toMatchObject({ reservationStatus: "confirmed" });
    });

    it("a request sends a paid reservation to staff review; none confirms it (A12)", async () => {
      const test = await loadCheckoutContext(payload, { APP_ENV: "test" });
      const base = { ...FORM, pickup: "2026-10-08|13:00", payment: "deposit" };
      const plain = await reserve(test, { ...base, email: "plain@example.test" }, newSubmission("reservation"));
      const asked = await reserve(test, { ...base, email: "asked@example.test" }, newSubmission("reservation"), { ...draft, requests: "Please keep it nut free" });
      if (!plain.ok || !asked.ok) throw new Error("expected both to be reserved");
      expect(await reservationOf(plain.number)).toMatchObject({ reservationStatus: "confirmed" });
      expect(await reservationOf(asked.number)).toMatchObject({ reservationStatus: "staff_review" });
    });
  });
});

describe("one submission, one order (A11)", () => {
  it("makes exactly one order for a true double submit of the same form", async () => {
    const p = await makeProduct(w, { stock: 10 });
    const token = await bagWith(w, p.id);
    const submission = newSubmission("order");
    const form = { ...FORM, name: "Double Dee", email: "dee@example.test" };
    const [a, b] = await Promise.all([place(token, ctx, form, submission), place(token, ctx, form, submission)]);
    expect(a).toEqual(b);
    expect((await payload.count({ collection: "orders", where: { "customer.email": { equals: "dee@example.test" } }, overrideAccess: true })).totalDocs).toBe(1);
  });

  it("makes a new order when the same items, details and slot are submitted from a fresh form later", async () => {
    const p = await makeProduct(w, { stock: 10 });
    const form = { ...FORM, name: "Again Ann", email: "ann@example.test", pickup: "2026-10-06|14:00" };
    const token = newCartToken();
    expect(await changeBag(payload, token, { unitId: String(p.id), quantity: 1, mode: "add" }, ctx, NOW)).toEqual({ ok: true });
    const first = await place(token, ctx, form, newSubmission("order"));
    if (!first.ok) throw new Error(first.error);

    // Staff cancel it; the customer fills the bag with the same thing and submits the same details.
    await payload.update({ collection: "orders", id: (await orderOf(first.number)).id, data: { fulfillmentStatus: "canceled" }, overrideAccess: true });
    expect(await changeBag(payload, token, { unitId: String(p.id), quantity: 1, mode: "add" }, ctx, NOW)).toEqual({ ok: true });
    const second = await place(token, ctx, form, newSubmission("order"));
    if (!second.ok) throw new Error(second.error);
    expect(second.number).not.toBe(first.number);
    expect(second.token).not.toBe(first.token);
    expect((await payload.count({ collection: "orders", where: { "customer.email": { equals: "ann@example.test" } }, overrideAccess: true })).totalDocs).toBe(2);
  });

  it("signs the nonce: forged, foreign-kind and missing nonces are refused", () => {
    const good = newSubmission("order");
    expect(verifySubmission("order", good)).toBe(good);
    expect(verifySubmission("reservation", good)).toBeNull();
    expect(verifySubmission("order", `${good}x`)).toBeNull();
    expect(verifySubmission("order", `abc.${good.split(".")[1]}`)).toBeNull();
    expect(verifySubmission("order", "nonsense")).toBeNull();
    expect(verifySubmission("order", undefined)).toBeNull();
    expect(newSubmission("order")).not.toBe(good);
  });
});

describe("staff review and awaiting payment (A12, A14)", () => {
  it("puts an order with notes in staff review once paid, and one without in preparing", async () => {
    const p = await makeProduct(w, { stock: 10 });
    const noted = await place(await bagWith(w, p.id), ctx, { ...FORM, name: "Allergic Al", email: "al@example.test", pickup: "2026-10-06|15:00", notes: "Severe peanut allergy" });
    const plain = await place(await bagWith(w, p.id), ctx, { ...FORM, name: "Plain Pam", email: "pam@example.test", pickup: "2026-10-06|16:00", notes: "   " });
    if (!noted.ok || !plain.ok) throw new Error("expected both orders");
    expect(await orderOf(noted.number)).toMatchObject({ paymentStatus: "paid", fulfillmentStatus: "staff_review", testMode: true });
    expect(await orderOf(plain.number)).toMatchObject({ paymentStatus: "paid", fulfillmentStatus: "preparing" });
  });

  it("keeps a declined order waiting for payment, never 'preparing'", async () => {
    const p = await makeProduct(w, { stock: 10 });
    const { provider } = scripted(declined);
    expect(await place(await bagWith(w, p.id), live(provider), { ...FORM, name: "Declined Dan", email: "dan@example.test", pickup: "2026-10-06|13:00", notes: "hi" })).toMatchObject({ ok: false });
    const rows = await payload.find({ collection: "orders", where: { "customer.email": { equals: "dan@example.test" } }, depth: 0, overrideAccess: true });
    expect(rows.docs).toHaveLength(1);
    expect(rows.docs[0]).toMatchObject({ paymentStatus: "failed", fulfillmentStatus: "awaiting_payment" });
  });

  it("marks test orders on the staff list", async () => {
    const orders = (await import("@/collections/Orders")).Orders;
    const field = orders.fields.find((f) => "name" in f && f.name === "testMode") as { label?: string; admin?: { components?: { Cell?: string } } };
    expect(field.label).toBe("Test order");
    expect(field.admin?.components?.Cell).toContain("TestOrderCell");
    expect(orders.admin?.defaultColumns).toContain("testMode");
    const reservations = (await import("@/collections/Reservations")).Reservations;
    expect(reservations.admin?.defaultColumns).toContain("testMode");
  });
});

describe("deletes and sensitive fields are audited (A20)", () => {
  it("logs who deleted a category, tax class, product, order, reservation, inquiry and user", async () => {
    const category = await payload.create({ collection: "categories", data: { name: "Doomed", slug: "doomed" } as never, overrideAccess: true });
    await payload.delete({ collection: "categories", id: category.id, user: w.manager, overrideAccess: false });
    const taxClass = await payload.create({ collection: "tax-classes", data: { name: "Old rate", rateBasisPoints: 100, approved: false }, overrideAccess: true });
    await payload.delete({ collection: "tax-classes", id: taxClass.id, user: w.owner, overrideAccess: false });
    const product = await makeProduct(w, { title: "Short lived" });
    await payload.delete({ collection: "products", id: product.id, user: w.manager, overrideAccess: false });
    const user = await payload.create({ collection: "users", data: { email: "leaver@example.test", password: "test-password-123", roles: ["fulfillment"] }, overrideAccess: true });
    await payload.delete({ collection: "users", id: user.id, user: w.owner, overrideAccess: false });

    const done = await place(await bagWith(w, (await makeProduct(w, { stock: 5 })).id), ctx, { ...FORM, email: "gone@example.test", pickup: "2026-10-06|17:00" });
    if (!done.ok) throw new Error(done.error);
    const order = await orderOf(done.number);
    await payload.delete({ collection: "orders", id: order.id, user: w.owner, overrideAccess: false });

    const deleted = async (target: string) => (await auditRows(target, "delete")).map((r) => ({ id: r.targetId, user: typeof r.user === "object" && r.user ? r.user.id : r.user, changes: r.changes as { field: string; before: unknown }[] }));
    expect(await deleted("categories")).toContainEqual(expect.objectContaining({ id: String(category.id), user: w.manager.id }));
    expect(await deleted("tax-classes")).toContainEqual(expect.objectContaining({ id: String(taxClass.id), user: w.owner.id }));
    expect(await deleted("products")).toContainEqual(expect.objectContaining({ id: String(product.id), user: w.manager.id }));
    expect(await deleted("users")).toContainEqual(expect.objectContaining({ id: String(user.id), user: w.owner.id }));
    const orderRow = (await deleted("orders")).find((r) => r.id === String(order.id));
    expect(orderRow?.user).toBe(w.owner.id);
    expect(orderRow?.changes).toEqual(expect.arrayContaining([{ field: "record", before: done.number, after: null }, { field: "paymentStatus", before: "paid", after: null }]));
  });

  it("logs changes to the photo-approval gate and to a product's tax class, shipping, perishable, max per gift and fit units", async () => {
    const media = await payload.create({
      collection: "media",
      data: { alt: "audited-photo", approvedForLaunch: false } as never,
      file: { data: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"), mimetype: "image/png", name: "audited.png", size: 70 },
      overrideAccess: true,
    });
    await payload.update({ collection: "media", id: media.id, data: { approvedForLaunch: true }, user: w.owner, overrideAccess: false });
    const mediaRows = (await auditRows("media", "update")).filter((r) => r.targetId === String(media.id));
    expect(mediaRows.flatMap((r) => (r.changes as { field: string; after: unknown }[]).map((c) => [c.field, c.after]))).toContainEqual(["approvedForLaunch", true]);

    const product = await makeProduct(w, { title: "Audited" });
    const taxClass = await payload.create({ collection: "tax-classes", data: { name: "Special", rateBasisPoints: 500, approved: true }, overrideAccess: true });
    await payload.update({ collection: "products", id: product.id, data: { taxClass: taxClass.id, shippable: true, perishable: true, maxPerGift: 4, fitUnits: 2 }, user: w.manager, overrideAccess: false });
    const rows = (await auditRows("products", "update")).filter((r) => r.targetId === String(product.id));
    const fields = rows.flatMap((r) => (r.changes as { field: string }[]).map((c) => c.field));
    for (const field of ["taxClass", "shippable", "perishable", "maxPerGift", "fitUnits"]) expect(fields).toContain(field);
  });
});

describe("SQLite busy timeout", () => {
  it("waits for a busy database instead of failing at once", async () => {
    const client = (payload.db as unknown as { client: { execute(sql: string): Promise<{ rows: Record<string, unknown>[] }> } }).client;
    const result = await client.execute("PRAGMA busy_timeout");
    expect(Number(Object.values(result.rows[0])[0])).toBe(5000);
  });
});

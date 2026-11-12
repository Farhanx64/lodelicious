/**
 * Checkout end to end with the Clover adapter on recorded-style fixtures, and products sold without
 * a stock count (D54). No network: Clover is a scripted `fetch`.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { Order } from "@/payload-types";
import { findByToken, loadCheckoutContext, placeOrder, type CheckoutContext } from "@/src/lib/checkout/service";
import { reconcilePaidHeld } from "@/src/lib/inventory/settle";
import { CloverPaymentProvider, cloverConfigFrom } from "@/src/lib/payments/clover";
import { readPaymentMethod } from "@/src/lib/payments/apple-pay";
import { applePayPaymentMethod, createdOrder, FAKE_CLOVER_ENV, paidOrder, scriptedFetch, serverError } from "@/src/lib/payments/clover-fixtures";
import { reconcileUnknownPayments } from "@/src/lib/payments/reconcile";

import { bagWith, FORM, liveStock, makeProduct, movementsFor, NOW, setupWorld, type World } from "./inventory-fixtures";

let w: World;
const CARD = "clv_1TSTfixturetoken";

const clover = (fetch: ReturnType<typeof scriptedFetch>["fetch"]) => new CloverPaymentProvider(cloverConfigFrom(FAKE_CLOVER_ENV), { fetch });
const withClover = (provider: CloverPaymentProvider): CheckoutContext => ({ ...w.ctx, provider, chargeTimeoutMs: 5_000 });

beforeAll(async () => {
  w = await setupWorld();
});

describe("products sold without a stock count (D54)", () => {
  it("can be bought by default, with nothing held or taken from stock", async () => {
    const untracked = await makeProduct(w, { stock: null, title: "Gummy bears" });
    const token = await bagWith(w, untracked.id, 3);
    const result = await placeOrder(w.payload, { cartToken: token, form: FORM, now: NOW }, w.ctx);
    if (!result.ok) throw new Error(result.error);
    const order = (await findByToken(w.payload, "orders", result.number, result.token)) as Order;
    expect(order).toMatchObject({ paymentStatus: "paid", stockStatus: "none" });
    expect(await liveStock(w.payload, untracked.id)).toBeNull();
    expect(await movementsFor(w.payload, untracked.id)).toHaveLength(0);
  });

  it("still takes counted stock in the same order, and the count still limits it", async () => {
    const untracked = await makeProduct(w, { stock: null });
    const counted = await makeProduct(w, { stock: 3, reserve: 1 });
    const token = await bagWith(w, untracked.id, 1);
    await bagWith(w, counted.id, 1); // another bag, to show the count is shared
    const { changeBag } = await import("@/src/lib/checkout/service");
    expect(await changeBag(w.payload, token, { unitId: String(counted.id), quantity: 5, mode: "add" }, w.ctx, NOW)).toEqual({ ok: true });
    const result = await placeOrder(w.payload, { cartToken: token, form: { ...FORM, pickup: "2026-10-06|12:00" }, now: NOW }, w.ctx);
    if (!result.ok) throw new Error(result.error);
    const order = (await findByToken(w.payload, "orders", result.number, result.token)) as Order;
    expect((order.lines as { unitId: string; quantity: number }[]).map((l) => l.quantity)).toEqual([1, 2]); // 3 counted − 1 reserve
    expect(order.stockStatus).toBe("committed");
    expect(await liveStock(w.payload, counted.id)).toBe(1);
  });

  it("is Currently unavailable again when the store default is switched off, unless the product says yes", async () => {
    await w.payload.updateGlobal({ slug: "inventory-settings", data: { untrackedAvailable: false }, user: w.manager, overrideAccess: false });
    const off = await loadCheckoutContext(w.payload, { APP_ENV: "test" });
    const plain = await makeProduct(w, { stock: null });
    const yes = await makeProduct(w, { stock: null });
    await w.payload.update({ collection: "products", id: yes.id, data: { alwaysAvailable: "yes" }, overrideAccess: true });
    const { changeBag, newCartToken } = await import("@/src/lib/checkout/service");
    expect(await changeBag(w.payload, newCartToken(), { unitId: String(plain.id), quantity: 1, mode: "add" }, off, NOW)).toMatchObject({ ok: false });
    expect(await changeBag(w.payload, newCartToken(), { unitId: String(yes.id), quantity: 1, mode: "add" }, off, NOW)).toEqual({ ok: true });
    await w.payload.updateGlobal({ slug: "inventory-settings", data: { untrackedAvailable: true }, overrideAccess: true });
  });
});

describe("checkout with the Clover adapter (fixtures)", () => {
  it("creates a Clover order with the lines and the pickup note, pays it, and keeps the Clover order id", async () => {
    const product = await makeProduct(w, { stock: 5, title: "Fudge box", priceCents: 1200 });
    const token = await bagWith(w, product.id, 2);
    // 2 × $12.00 = $24.00, tax 6.25% = $1.50 → $25.50
    const { fetch, calls } = scriptedFetch({ status: 200, body: createdOrder(2550, "ORDPICKUP01") }, { status: 200, body: paidOrder(2550, "ORDPICKUP01", "CHGPICKUP01") });
    const result = await placeOrder(w.payload, { cartToken: token, form: { ...FORM, pickup: "2026-10-06|13:00", notes: "", cardToken: CARD }, clientIp: "203.0.113.5", now: NOW }, withClover(clover(fetch)));
    if (!result.ok) throw new Error(result.error);

    const order = (await findByToken(w.payload, "orders", result.number, result.token)) as Order;
    expect(order).toMatchObject({ paymentStatus: "paid", testMode: true, payment: { provider: "clover", reference: "CHGPICKUP01", providerOrderId: "ORDPICKUP01" }, stockStatus: "committed" });
    const body = calls[0].body as { items: unknown[]; metadata: Record<string, string>; email: string };
    expect(body.items).toEqual([{ type: "sku", amount: 2400, currency: "usd", quantity: 1, description: "2 × Fudge box", tax_rates: [{ name: "Sales Tax", rate: 625000 }] }]);
    expect(body.email).toBe(FORM.email);
    expect(body.metadata).toMatchObject({ website_number: order.number, customer_name: FORM.name, fulfillment: `${order.number}: Pickup Tuesday, October 6, 1:00 PM–2:00 PM` });
    expect(calls[1].body).toEqual({ source: CARD, email: FORM.email, ecomind: "ecom" });
    expect(calls.every((c) => c.headers["idempotency-key"]?.startsWith(order.idempotencyKey))).toBe(true);
  });

  it("asks for the card before holding stock or calling Clover", async () => {
    const product = await makeProduct(w, { stock: 5 });
    const token = await bagWith(w, product.id, 1);
    const { fetch, calls } = scriptedFetch();
    expect(await placeOrder(w.payload, { cartToken: token, form: { ...FORM, pickup: "2026-10-06|14:00" }, now: NOW }, withClover(clover(fetch)))).toEqual({ ok: false, error: "Please enter your card details." });
    expect(calls).toHaveLength(0);
    expect(await w.payload.count({ collection: "stock-holds", where: { product: { equals: product.id } }, overrideAccess: true })).toMatchObject({ totalDocs: 0 });
  });

  it("a declined card releases the stock and keeps the bag; the retry is a new Clover order and pays", async () => {
    const product = await makeProduct(w, { stock: 5, priceCents: 1000 });
    const token = await bagWith(w, product.id, 1);
    const form = { ...FORM, pickup: "2026-10-06|15:00", cardToken: CARD };
    const first = scriptedFetch({ status: 200, body: createdOrder(1063, "ORDDECLINE1") }, { status: 402, body: { error: { type: "card_error", code: "card_declined" } } });
    expect(await placeOrder(w.payload, { cartToken: token, form, now: NOW }, withClover(clover(first.fetch)))).toMatchObject({ ok: false, error: expect.stringMatching(/declined.*Your bag is saved/) });
    expect(await liveStock(w.payload, product.id)).toBe(5);

    const second = scriptedFetch({ status: 200, body: createdOrder(1063, "ORDRETRY01") }, { status: 200, body: paidOrder(1063, "ORDRETRY01") });
    const retry = await placeOrder(w.payload, { cartToken: token, form, now: NOW }, withClover(clover(second.fetch)));
    if (!retry.ok) throw new Error(retry.error);
    expect(first.calls[0].headers["idempotency-key"]).toMatch(/:1:order$/);
    expect(second.calls[0].headers["idempotency-key"]).toMatch(/:2:order$/);
    expect(await liveStock(w.payload, product.id)).toBe(4);
  });

  it("an unclear answer is unknown; the reconcile job later reads Clover, marks it paid, and the stock is taken", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const product = await makeProduct(w, { stock: 5, priceCents: 1000 });
    const token = await bagWith(w, product.id, 1);
    const pay = scriptedFetch({ status: 200, body: createdOrder(1063, "ORDUNKNOWN1") }, { status: 503, body: serverError });
    const result = await placeOrder(w.payload, { cartToken: token, form: { ...FORM, pickup: "2026-10-06|16:00", cardToken: CARD }, now: NOW }, withClover(clover(pay.fetch)));
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/don't pay again/) });
    const { docs } = await w.payload.find({ collection: "orders", where: { "payment.providerOrderId": { equals: "ORDUNKNOWN1" } }, overrideAccess: true });
    expect(docs[0]).toMatchObject({ paymentStatus: "unknown", stockStatus: "held" });

    // Clover still says "created": nothing changes.
    const notYet = scriptedFetch({ status: 200, body: createdOrder(1063, "ORDUNKNOWN1") });
    expect(await reconcileUnknownPayments(w.payload, clover(notYet.fetch))).toMatchObject({ checked: 1, paid: 0, stillUnknown: 1 });
    // Then it is paid.
    const later = scriptedFetch({ status: 200, body: paidOrder(1063, "ORDUNKNOWN1", "CHGLATE01") });
    expect(await reconcileUnknownPayments(w.payload, clover(later.fetch))).toMatchObject({ checked: 1, paid: 1 });
    expect(later.calls.map((c) => c.method)).toEqual(["GET"]);
    await reconcilePaidHeld(w.payload, NOW);
    const after = (await w.payload.findByID({ collection: "orders", id: docs[0].id, overrideAccess: true })) as Order;
    expect(after).toMatchObject({ paymentStatus: "paid", fulfillmentStatus: "preparing", stockStatus: "committed", payment: { reference: "CHGLATE01", providerOrderId: "ORDUNKNOWN1" } });
    expect(await liveStock(w.payload, product.id)).toBe(4);
    spy.mockRestore();
  });

  it("ships with the Clover order carrying the shipping line and address", async () => {
    const product = await makeProduct(w, { stock: 5, priceCents: 1000 });
    await w.payload.update({ collection: "products", id: product.id, data: { shippable: true }, overrideAccess: true });
    const token = await bagWith(w, product.id, 1);
    const { fetch, calls } = scriptedFetch({ status: 200, body: createdOrder(1958, "ORDSHIP01") }, { status: 200, body: paidOrder(1958, "ORDSHIP01") });
    const result = await placeOrder(
      w.payload,
      { cartToken: token, form: { ...FORM, method: "ship", shipLine1: "9 Ocean Ave", shipCity: "Plymouth", shipState: "MA", shipZip: "02360", cardToken: CARD }, now: NOW },
      withClover(clover(fetch)),
    );
    if (!result.ok) throw new Error(result.error);
    const body = calls[0].body as { items: { type: string; amount: number }[]; shipping: unknown; metadata: Record<string, string> };
    expect(body.items.at(-1)).toEqual({ type: "shipping", amount: 895, currency: "usd", quantity: 1, description: "Shipping" });
    expect(body.shipping).toEqual({ name: FORM.name, phone: FORM.phone, address: { line1: "9 Ocean Ave", city: "Plymouth", state: "MA", postal_code: "02360", country: "US" } });
    expect(body.metadata.fulfillment).toMatch(/Ship to Pat Customer, 9 Ocean Ave, Plymouth, MA 02360$/);
  });
});

describe("Apple Pay pays through the card path (D59, fixtures)", () => {
  // What the browser sends: the form, with Apple Pay's token where the card token goes, and `wallet`.
  const applePayForm = (pickup: string) => {
    const payment = readPaymentMethod(applePayPaymentMethod());
    if (!payment) throw new Error("fixture token refused");
    return { ...FORM, pickup, cardToken: payment.token, wallet: "apple_pay" };
  };

  it("charges Apple Pay's token as the source, with the same order, total check and idempotency keys", async () => {
    const product = await makeProduct(w, { stock: 5, priceCents: 1000 });
    const token = await bagWith(w, product.id, 1);
    const { fetch, calls } = scriptedFetch({ status: 200, body: createdOrder(1063, "ORDAPPLE01") }, { status: 200, body: paidOrder(1063, "ORDAPPLE01", "CHGAPPLE01") });
    const result = await placeOrder(w.payload, { cartToken: token, form: applePayForm("2026-10-07|11:00"), now: NOW }, withClover(clover(fetch)));
    if (!result.ok) throw new Error(result.error);
    const order = (await findByToken(w.payload, "orders", result.number, result.token)) as Order;
    expect(order).toMatchObject({ paymentStatus: "paid", payment: { provider: "clover", reference: "CHGAPPLE01", providerOrderId: "ORDAPPLE01" }, stockStatus: "committed" });
    expect(calls.map((c) => c.url.replace(/^https:\/\/[^/]+/, ""))).toEqual(["/v1/orders", "/v1/orders/ORDAPPLE01/pay"]);
    expect(calls[1].body).toEqual({ source: "clv_1TSTapplepaytoken", email: FORM.email, ecomind: "ecom" });
    expect(calls[0].headers["idempotency-key"]).toBe(`${order.idempotencyKey}:1:order`);
    expect(calls.every((c) => c.headers["idempotency-key"]?.startsWith(order.idempotencyKey))).toBe(true);
  });

  it("charges nothing when Clover's total differs from ours, and releases the hold", async () => {
    const product = await makeProduct(w, { stock: 5, priceCents: 1000 });
    const token = await bagWith(w, product.id, 1);
    const { fetch, calls } = scriptedFetch({ status: 200, body: createdOrder(9999, "ORDAPPLE02") });
    expect(await placeOrder(w.payload, { cartToken: token, form: applePayForm("2026-10-07|12:00"), now: NOW }, withClover(clover(fetch)))).toMatchObject({ ok: false });
    expect(calls).toHaveLength(1); // the order only; no pay call
    expect(await liveStock(w.payload, product.id)).toBe(5);
  });

  it("refuses a wallet token that isn't a Clover token before holding stock or calling Clover", async () => {
    const product = await makeProduct(w, { stock: 5 });
    const token = await bagWith(w, product.id, 1);
    const { fetch, calls } = scriptedFetch();
    const form = { ...FORM, pickup: "2026-10-07|13:00", cardToken: "tok_not_clover", wallet: "apple_pay" };
    expect(await placeOrder(w.payload, { cartToken: token, form, now: NOW }, withClover(clover(fetch)))).toEqual({ ok: false, error: "Please enter your card details." });
    expect(calls).toHaveLength(0);
  });
});

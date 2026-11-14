/**
 * Sales tax by the ship-to state, end to end (D65): pickup and MA shipping charge exactly as
 * before; shipping to any other state charges no sales tax and tells Clover so with NO_TAX_APPLIED.
 * Rewards, reservations and the page's total check use the same rule. No network: Clover is a
 * scripted `fetch`.
 */
import type { Payload } from "payload";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { Order, Product, Reservation } from "@/payload-types";
import { priceCart } from "@/src/lib/checkout/cart";
import { findByToken, loadCheckoutContext, placeOrder, reserveBasket, type BasketDraft, type CheckoutContext } from "@/src/lib/checkout/service";
import { newSubmission } from "@/src/lib/checkout/submission";
import { bagTaxViews, byView } from "@/src/lib/checkout/tax-views";
import { CloverPaymentProvider, cloverConfigFrom } from "@/src/lib/payments/clover";
import { createdOrder, FAKE_CLOVER_ENV, paidOrder, scriptedFetch } from "@/src/lib/payments/clover-fixtures";
import { entryKey, postEntry } from "@/src/lib/rewards/ledger";
import { joinMember, loadRewardsConfig } from "@/src/lib/rewards/members";

import { FORM, liveStock, makeProduct, NOW, setupWorld, type World } from "./inventory-fixtures";

let w: World;
let payload: Payload;
const CARD = "clv_1TSTfixturetoken";
const SHIP = { method: "ship", shipLine1: "9 Ocean Ave", shipZip: "02360" };
const MA = { ...SHIP, shipCity: "Plymouth", shipState: "MA" };
const NY = { ...SHIP, shipCity: "Albany", shipState: "NY", shipZip: "12207" };

const clover = (fetch: ReturnType<typeof scriptedFetch>["fetch"]) => new CloverPaymentProvider(cloverConfigFrom(FAKE_CLOVER_ENV), { fetch });
const withClover = (ctx: CheckoutContext, fetch: ReturnType<typeof scriptedFetch>["fetch"]): CheckoutContext => ({ ...ctx, provider: clover(fetch), chargeTimeoutMs: 5_000 });

let slot = 0;
/** A fresh pickup slot each time, so idempotency keys never collide between tests. */
const pickup = () => `2026-10-${String(6 + Math.floor(slot / 7)).padStart(2, "0")}|${String(11 + (slot++ % 7)).padStart(2, "0")}:00`;

async function shippable(priceCents: number): Promise<Product> {
  const p = await makeProduct(w, { stock: 20, priceCents });
  return (await payload.update({ collection: "products", id: p.id, data: { shippable: true }, overrideAccess: true })) as Product;
}

async function bagOf(ctx: CheckoutContext, priceCents: number): Promise<string> {
  const { changeBag, newCartToken } = await import("@/src/lib/checkout/service");
  const p = await shippable(priceCents);
  const token = newCartToken();
  const r = await changeBag(payload, token, { unitId: String(p.id), quantity: 1, mode: "add" }, ctx, NOW);
  if (!r.ok) throw new Error(r.error);
  return token;
}

const orderOf = async (result: Awaited<ReturnType<typeof placeOrder>>) => {
  if (!result.ok) throw new Error(result.error);
  return (await findByToken(payload, "orders", result.number, result.token)) as Order;
};

beforeAll(async () => {
  w = await setupWorld();
  payload = w.payload;
});

describe("the setting (Checkout & reservations → Tax → Tax by ship-to state)", () => {
  it("starts with only MA at the default class's rate, with help text that says when to add a state", async () => {
    const settings = await payload.findGlobal({ slug: "checkout-settings", depth: 0, overrideAccess: true });
    expect(settings.shipTaxStates?.map(({ state, ratePercent, cloverTaxName }) => ({ state, ratePercent, cloverTaxName }))).toEqual([{ state: "MA", ratePercent: 6.25, cloverTaxName: "Sales Tax" }]);
    expect(w.ctx.shipTaxRules).toEqual([{ state: "MA", rateBasisPoints: 625, cloverTaxName: "Sales Tax" }]);
    const { CheckoutSettings } = await import("@/globals/CheckoutSettings");
    expect(JSON.stringify(CheckoutSettings.fields)).toContain("Only add a state if the shop is registered to collect its sales tax.");
  });

  it("refuses a state listed twice and a rate with more than two decimals", async () => {
    const save = (rows: unknown[]) => payload.updateGlobal({ slug: "checkout-settings", data: { shipTaxStates: rows } as never, user: w.manager, overrideAccess: false });
    const twice = await save([{ state: "MA", ratePercent: 6.25 }, { state: "MA", ratePercent: 5 }]).catch((e: unknown) => e);
    expect(JSON.stringify((twice as { data?: unknown }).data)).toMatch(/MA is listed twice/);
    await expect(save([{ state: "MA", ratePercent: 6.255 }])).rejects.toThrow();
    await expect(payload.updateGlobal({ slug: "checkout-settings", data: { shipTaxStates: [] } as never, user: w.fulfillment, overrideAccess: false })).rejects.toThrow(/not allowed/i);
  });
});

describe("orders", () => {
  it("pickup: taxed exactly as before, labelled Tax, Clover on the default Sales Tax rate", async () => {
    const token = await bagOf(w.ctx, 1000);
    const { fetch, calls } = scriptedFetch({ status: 200, body: createdOrder(1063, "ORDPICK01") }, { status: 200, body: paidOrder(1063, "ORDPICK01") });
    const order = await orderOf(await placeOrder(payload, { cartToken: token, form: { ...FORM, pickup: pickup(), cardToken: CARD }, now: NOW }, withClover(w.ctx, fetch)));
    expect(order.totals).toMatchObject({ subtotalCents: 1000, taxCents: 63, shippingCents: 0, totalCents: 1063, taxLabel: "Tax" });
    expect((calls[0].body as { items: { tax_rates?: unknown }[] }).items[0].tax_rates).toEqual([{ name: "Sales Tax", rate: 625000 }]);
  });

  it("ships to MA: the same tax as pickup, shipping untaxed, labelled Tax (MA 6.25%)", async () => {
    const token = await bagOf(w.ctx, 1000);
    const { fetch, calls } = scriptedFetch({ status: 200, body: createdOrder(1958, "ORDMA01") }, { status: 200, body: paidOrder(1958, "ORDMA01") });
    const order = await orderOf(await placeOrder(payload, { cartToken: token, form: { ...FORM, ...MA, cardToken: CARD }, now: NOW }, withClover(w.ctx, fetch)));
    expect(order).toMatchObject({ paymentStatus: "paid", totals: { subtotalCents: 1000, taxCents: 63, shippingCents: 895, totalCents: 1958, taxLabel: "Tax (MA 6.25%)" } });
    const items = (calls[0].body as { items: Record<string, unknown>[] }).items;
    expect(items[0].tax_rates).toEqual([{ name: "Sales Tax", rate: 625000 }]);
    expect(items[1]).toEqual({ type: "shipping", amount: 895, currency: "usd", quantity: 1, description: "Shipping" });
  });

  it("ships to NY: no sales tax, Clover told NO_TAX_APPLIED, labelled No sales tax (ships to NY)", async () => {
    const token = await bagOf(w.ctx, 1000);
    const { fetch, calls } = scriptedFetch({ status: 200, body: createdOrder(1895, "ORDNY01") }, { status: 200, body: paidOrder(1895, "ORDNY01") });
    const order = await orderOf(await placeOrder(payload, { cartToken: token, form: { ...FORM, ...NY, cardToken: CARD }, now: NOW }, withClover(w.ctx, fetch)));
    expect(order).toMatchObject({ paymentStatus: "paid", totals: { subtotalCents: 1000, taxCents: 0, shippingCents: 895, totalCents: 1895, taxLabel: "No sales tax (ships to NY)" } });
    expect((order.lines as { taxCents: number; taxClass: { rateBasisPoints: number } }[])[0]).toMatchObject({ taxCents: 0, taxClass: { rateBasisPoints: 0 } });
    const items = (calls[0].body as { items: Record<string, unknown>[] }).items;
    expect(items[0].tax_rates).toEqual([{ name: "NO_TAX_APPLIED", rate: 0 }]);
    expect(calls[1].body).toMatchObject({ source: CARD });
  });

  it("the server goes by the submitted address: a page total for MA with a NY address charges nothing and says the real total", async () => {
    const token = await bagOf(w.ctx, 1000);
    const { fetch, calls } = scriptedFetch();
    const holds = async () => (await payload.count({ collection: "stock-holds", overrideAccess: true })).totalDocs;
    const before = await holds();
    const result = await placeOrder(payload, { cartToken: token, form: { ...FORM, ...NY, cardToken: CARD, expectedCents: "1958" }, now: NOW }, withClover(w.ctx, fetch));
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/Your total is \$18\.95 for this address.*Nothing was charged/) });
    expect(calls).toHaveLength(0);
    expect(await holds()).toBe(before); // nothing held, no order made
    // The page's figure for NY matches: it goes through.
    const ok = scriptedFetch({ status: 200, body: createdOrder(1895, "ORDNY02") }, { status: 200, body: paidOrder(1895, "ORDNY02") });
    expect(await placeOrder(payload, { cartToken: token, form: { ...FORM, ...NY, cardToken: CARD, expectedCents: "1895" }, now: NOW }, withClover(w.ctx, ok.fetch))).toMatchObject({ ok: true });
  });

  it("refuses to pay when Clover's total for a NY order includes tax (total mismatch), releasing the stock", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const p = await shippable(1000);
    const { changeBag, newCartToken } = await import("@/src/lib/checkout/service");
    const token = newCartToken();
    await changeBag(payload, token, { unitId: String(p.id), quantity: 1, mode: "add" }, w.ctx, NOW);
    const { fetch, calls } = scriptedFetch({ status: 200, body: createdOrder(1958, "ORDNYTAX") });
    expect(await placeOrder(payload, { cartToken: token, form: { ...FORM, ...NY, cardToken: CARD }, now: NOW }, withClover(w.ctx, fetch))).toMatchObject({ ok: false });
    expect(calls).toHaveLength(1); // the order only; no pay call
    expect(await liveStock(payload, p.id)).toBe(20);
    vi.restoreAllMocks();
  });

  it("follows the list: a state added at its own rate and Clover name; MA removed means MA shipping is untaxed; pickup never changes", async () => {
    await payload.updateGlobal({
      slug: "checkout-settings",
      data: { shipTaxStates: [{ state: "NY", ratePercent: 4, cloverTaxName: "NY Sales Tax" }] } as never,
      user: w.manager,
      overrideAccess: false,
    });
    const ctx = await loadCheckoutContext(payload, { APP_ENV: "test" });
    expect(ctx.shipTaxRules).toEqual([{ state: "NY", rateBasisPoints: 400, cloverTaxName: "NY Sales Tax" }]);

    const ny = scriptedFetch({ status: 200, body: createdOrder(1935, "ORDNY4") }, { status: 200, body: paidOrder(1935, "ORDNY4") });
    const nyOrder = await orderOf(await placeOrder(payload, { cartToken: await bagOf(ctx, 1000), form: { ...FORM, ...NY, cardToken: CARD }, now: NOW }, withClover(ctx, ny.fetch)));
    expect(nyOrder.totals).toMatchObject({ taxCents: 40, totalCents: 1935, taxLabel: "Tax (NY 4%)" });
    expect((ny.calls[0].body as { items: Record<string, unknown>[] }).items[0].tax_rates).toEqual([{ name: "NY Sales Tax", rate: 400000 }]);

    const ma = await orderOf(await placeOrder(payload, { cartToken: await bagOf(ctx, 1000), form: { ...FORM, ...MA }, now: NOW }, ctx));
    expect(ma.totals).toMatchObject({ taxCents: 0, totalCents: 1895, taxLabel: "No sales tax (ships to MA)" });
    const pick = await orderOf(await placeOrder(payload, { cartToken: await bagOf(ctx, 1000), form: { ...FORM, pickup: pickup() }, now: NOW }, ctx));
    expect(pick.totals).toMatchObject({ taxCents: 63, totalCents: 1063 });

    await payload.updateGlobal({ slug: "checkout-settings", data: { shipTaxStates: [{ state: "MA", ratePercent: 6.25, cloverTaxName: "Sales Tax" }] } as never, overrideAccess: true });
  });
});

describe("rewards with ship-to tax (D47 + D65)", () => {
  let ctx: CheckoutContext;
  let memberId: number;

  beforeAll(async () => {
    await payload.updateGlobal({ slug: "rewards-settings", data: { enabled: true, pointsPerDollar: 1, welcomePoints: 0, rewards: [{ pointsRequired: 100, discountCents: 500 }], terms: "Points have no cash value." }, user: w.manager, overrideAccess: false });
    await payload.updateGlobal({ slug: "rewards-settings", data: { approved: true }, user: w.owner, overrideAccess: false });
    ctx = await loadCheckoutContext(payload, { APP_ENV: "test" });
    const joined = await joinMember(payload, { name: "Mo Member", email: "mo@example.test", password: "Sweet-Treats-2026", agree: "yes" }, await loadRewardsConfig(payload), NOW);
    if (!joined.ok) throw new Error(joined.error);
    memberId = joined.member.id;
    await postEntry(payload, { memberId, kind: "adjust", points: 300, key: entryKey.adjust(`ship-tax-${memberId}`), note: "test" });
  });

  it("the reward comes off before tax: MA taxes what is left, NY taxes nothing; the page's wallet amounts match the charge", async () => {
    const option = ctx.rewards.config.options[0];
    const place = async (address: Record<string, string>) => {
      const token = await bagOf(ctx, 2000);
      // What the page would show for this bag (and put in the Apple Pay / Google Pay sheet).
      const p = await payload.find({ collection: "products", where: { priceCents: { equals: 2000 } }, sort: "-id", limit: 1, depth: 0, overrideAccess: true });
      const bag = priceCart([{ unitId: String(p.docs[0].id), quantity: 1 }], p.docs as Product[], { previewStock: false, taxClasses: ctx.taxClasses, defaultTaxClassId: ctx.defaultTaxClassId });
      const wallets = byView(bagTaxViews(bag, { method: "ship", shippingCents: 895, rules: ctx.shipTaxRules, rewards: [option] }), (v) => v.wallet);
      const expected = (address.shipState === "MA" ? wallets.MA : wallets.none).byChoice!.cents[option.id];
      const order = await orderOf(await placeOrder(payload, { cartToken: token, form: { ...FORM, ...address, reward: option.id, expectedCents: String(expected) }, submission: newSubmission("order"), memberId, now: NOW }, ctx));
      return { order, expected };
    };
    const ma = await place(MA);
    // $20 − $5 = $15, 6.25% = $0.94, + $8.95 shipping.
    expect(ma.order.totals).toMatchObject({ subtotalCents: 2000, discountCents: 500, taxCents: 94, shippingCents: 895, totalCents: 2489 });
    expect(ma.expected).toBe(2489);
    const ny = await place(NY);
    expect(ny.order.totals).toMatchObject({ subtotalCents: 2000, discountCents: 500, taxCents: 0, shippingCents: 895, totalCents: 2395, taxLabel: "No sales tax (ships to NY)" });
    expect(ny.expected).toBe(2395);
    // Points are earned on what was paid before tax, the same either way.
    expect(ma.order.rewards?.earnPoints).toBe(15);
    expect(ny.order.rewards?.earnPoints).toBe(15);
  });
});

describe("basket reservations", () => {
  let draft: BasketDraft;

  beforeAll(async () => {
    const items: Product[] = [];
    for (let i = 0; i < 6; i++) {
      const item = await makeProduct(w, { title: `Ship tax item ${i}`, stock: 20, reserve: 1, priceCents: 400, basketEligible: true });
      items.push((await payload.update({ collection: "products", id: item.id, data: { giftTypes: ["sweet"], shippable: true }, overrideAccess: true })) as Product);
    }
    draft = { request: { kind: "custom", size: "small", giftType: "sweet", budgetCents: null, selections: items.map((p) => ({ productId: String(p.id), quantity: 1 })) }, message: "", requests: "" };
  });

  const reserve = (form: Record<string, unknown>, fetch: ReturnType<typeof scriptedFetch>["fetch"]) =>
    reserveBasket(payload, { draft, form: { ...FORM, ...form, cardToken: CARD }, submission: newSubmission("reservation"), now: NOW }, withClover(w.ctx, fetch));
  const reservationOf = async (result: Awaited<ReturnType<typeof reserveBasket>>) => {
    if (!result.ok) throw new Error(result.error);
    return (await findByToken(payload, "reservations", result.number, result.token)) as Reservation;
  };

  it("a basket shipped to NY pays no sales tax, in full, with Clover told NO_TAX_APPLIED; to MA it pays the pickup tax", async () => {
    const { priceBasket } = await import("@/src/lib/checkout/service");
    const priced = await priceBasket(payload, draft, w.ctx, { now: NOW });
    if (!priced.ok) throw new Error(priced.error);
    if (!priced.shipping.available) throw new Error("basket should ship");
    const shippingCents = priced.shipping.cents;

    const nyTotal = priced.subtotalCents + shippingCents;
    const ny = scriptedFetch({ status: 200, body: createdOrder(nyTotal, "ORDRNY01") }, { status: 200, body: paidOrder(nyTotal, "ORDRNY01") });
    const nyRes = await reservationOf(await reserve({ ...NY, name: "Nia NY", email: "nia@example.test" }, ny.fetch));
    expect(nyRes).toMatchObject({ taxCents: 0, totalCents: nyTotal, depositCents: nyTotal, paymentStatus: "paid_in_full", taxLabel: "No sales tax (ships to NY)" });
    expect((ny.calls[0].body as { items: Record<string, unknown>[] }).items[0].tax_rates).toEqual([{ name: "NO_TAX_APPLIED", rate: 0 }]);

    const maTotal = priced.totalCents + shippingCents;
    const ma = scriptedFetch({ status: 200, body: createdOrder(maTotal, "ORDRMA01") }, { status: 200, body: paidOrder(maTotal, "ORDRMA01") });
    const maRes = await reservationOf(await reserve({ ...MA, name: "Max MA", email: "max@example.test" }, ma.fetch));
    expect(maRes).toMatchObject({ taxCents: priced.taxCents, totalCents: maTotal, taxLabel: "Tax (MA 6.25%)" });
    expect(priced.taxCents).toBeGreaterThan(0);
  });

  it("refuses a shown total that doesn't match the address before charging", async () => {
    const { fetch, calls } = scriptedFetch();
    const result = await reserve({ ...NY, name: "Pia", email: "pia@example.test", expectedCents: "1" }, fetch);
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/Nothing was charged/) });
    expect(calls).toHaveLength(0);
  });

  it("pickup keeps the deposit rules and tax exactly as before", async () => {
    const { priceBasket } = await import("@/src/lib/checkout/service");
    const priced = await priceBasket(payload, draft, w.ctx, { now: NOW });
    if (!priced.ok) throw new Error(priced.error);
    const { fetch } = scriptedFetch({ status: 200, body: createdOrder(priced.totalCents, "ORDRPK01") }, { status: 200, body: { ...paidOrder(priced.totalCents, "ORDRPK01"), status: "partially_paid", amount_paid: 10_000 } });
    const res = await reservationOf(await reserve({ pickup: "2026-10-08|11:00", payment: "deposit", name: "Pat Pickup", email: "pp@example.test" }, fetch));
    expect(res).toMatchObject({ taxCents: priced.taxCents, totalCents: priced.totalCents, taxLabel: "Tax", paymentStatus: "deposit_paid" });
  });
});

/**
 * Shipping labels through Shippo (D66), end to end against the database with a scripted Shippo.
 * A test token makes a sample label and leaves the order alone; a live token fills in tracking and
 * saves Shipped, once, and never for an unpaid or TEST order. No network.
 */
import type { Payload, PayloadRequest } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

import type { Order } from "@/payload-types";
import { findByToken, placeOrder } from "@/src/lib/checkout/service";
import { buyHandler, ratesHandler } from "@/src/lib/shipping/label-endpoints";
import { carrierOf, dimsFromBoxLabel, parseLocality, shippoSettingFrom, validParcel } from "@/src/lib/shipping/shippo";

import { bagWith, FORM, makeProduct, NOW, setupWorld, type World } from "./inventory-fixtures";

const TEST = { SHIPPO_API_TOKEN: `shippo_test_${"a".repeat(40)}` };
const LIVE = { SHIPPO_API_TOKEN: `shippo_live_${"b".repeat(40)}` };
const SHIPMENT = "1".repeat(32);
const RATE = "2".repeat(32);
const PARCEL = { lengthIn: 16, widthIn: 10, heightIn: 16, weightLbs: 3.5 };

let w: World;
let payload: Payload;

function shippo() {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const fetch = async (url: string, init: RequestInit) => {
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method: String(init.method), body });
    expect(new Headers(init.headers).get("Authorization")).toMatch(/^ShippoToken shippo_/);
    if (url.endsWith("/shipments/"))
      return Response.json({
        object_id: SHIPMENT,
        rates: [
          { object_id: "3".repeat(32), provider: "UPS", servicelevel: { name: "Ground" }, amount: "18.20", currency: "USD", estimated_days: 3 },
          { object_id: RATE, provider: "USPS", servicelevel: { name: "Ground Advantage" }, amount: "9.45", currency: "USD", estimated_days: 4 },
        ],
      });
    if (url.endsWith(`/rates/${RATE}`)) return Response.json({ object_id: RATE, shipment: SHIPMENT, provider: "USPS", servicelevel: { name: "Ground Advantage" }, amount: "9.45" });
    if (url.endsWith("/transactions/")) return Response.json({ object_id: "4".repeat(32), status: "SUCCESS", tracking_number: "9400 1000 0000 0000 0000 00", label_url: "https://deliver.goshippo.com/label.pdf" });
    return Response.json({ detail: "not found" }, { status: 404 });
  };
  return { fetch, calls };
}

const req = (id: number | string, body: unknown, user: unknown = w.fulfillment) =>
  ({ payload, user, routeParams: { id: String(id) }, json: async () => body }) as unknown as PayloadRequest;

async function shippedOrder(): Promise<Order> {
  const p = await makeProduct(w, { stock: 20, priceCents: 1000 });
  await payload.update({ collection: "products", id: p.id, data: { shippable: true }, overrideAccess: true });
  const token = await bagWith(w, p.id);
  const form = { ...FORM, method: "ship", shipLine1: "9 Ocean Ave", shipCity: "Albany", shipState: "NY", shipZip: "12207" };
  const r = await placeOrder(payload, { cartToken: token, form, now: NOW }, w.ctx);
  if (!r.ok) throw new Error(r.error);
  return (await findByToken(payload, "orders", r.number, r.token)) as Order;
}
const reload = async (id: number | string) => (await payload.findByID({ collection: "orders", id, depth: 0, overrideAccess: true })) as Order;

beforeAll(async () => {
  w = await setupWorld();
  payload = w.payload;
});

describe("parts", () => {
  it("reads the token, the shop's town line, the box text, the parcel and the carrier", () => {
    expect(shippoSettingFrom({})).toEqual({ kind: "off" });
    expect(shippoSettingFrom({ SHIPPO_API_TOKEN: "nope" })).toMatchObject({ kind: "misconfigured" });
    expect(shippoSettingFrom(TEST)).toMatchObject({ kind: "on", config: { test: true } });
    expect(shippoSettingFrom(LIVE)).toMatchObject({ kind: "on", config: { test: false } });
    expect(parseLocality("Plymouth, MA 02360")).toEqual({ city: "Plymouth", state: "MA", zip: "02360" });
    expect(parseLocality("Plymouth")).toBeNull();
    expect(dimsFromBoxLabel("Medium box, 16 × 10 × 16 in")).toEqual({ lengthIn: 16, widthIn: 10, heightIn: 16 });
    expect(validParcel({ lengthIn: "16", widthIn: 10, heightIn: 16, weightLbs: "3.5" })).toEqual(PARCEL);
    expect(validParcel({ ...PARCEL, weightLbs: 0 })).toBeNull();
    expect([carrierOf("USPS"), carrierOf("UPS"), carrierOf("FedEx"), carrierOf("DHL Express")]).toEqual(["usps", "ups", "fedex", "other"]);
  });
});

describe("labels", () => {
  it("test token: rates cheapest first, a sample label saved, the order's status and tracking untouched", async () => {
    const order = await shippedOrder();
    const s = shippo();
    const rates = await ratesHandler(req(order.id, PARCEL), { env: TEST, fetch: s.fetch });
    expect(rates.status).toBe(200);
    const body = (await rates.json()) as { test: boolean; rates: { id: string; amountCents: number }[] };
    expect(body.test).toBe(true);
    expect(body.rates.map((r) => r.amountCents)).toEqual([945, 1820]);
    expect((s.calls[0].body as { address_from: { city: string }; address_to: { city: string; state: string } }).address_to).toMatchObject({ city: "Albany", state: "NY" });

    const bought = await buyHandler(req(order.id, { rateId: RATE }), { env: TEST, fetch: s.fetch, now: () => NOW });
    expect(bought.status).toBe(200);
    const after = await reload(order.id);
    expect(after.shippingLabel).toMatchObject({ test: true, labelUrl: "https://deliver.goshippo.com/label.pdf", service: "USPS Ground Advantage", costCents: 945 });
    expect(after.fulfillmentStatus).toBe(order.fulfillmentStatus);
    expect(after.trackingNumber ?? null).toBeNull();
  });

  it("live token: tracking filled in and saved Shipped; a second label is refused", async () => {
    const order = await shippedOrder();
    await payload.update({ collection: "orders", id: order.id, data: { testMode: false, paymentStatus: "paid" } as never, overrideAccess: true });
    const s = shippo();
    expect((await ratesHandler(req(order.id, PARCEL), { env: LIVE, fetch: s.fetch })).status).toBe(200);
    expect((await buyHandler(req(order.id, { rateId: RATE }), { env: LIVE, fetch: s.fetch })).status).toBe(200);
    const after = await reload(order.id);
    expect(after).toMatchObject({ fulfillmentStatus: "shipped", trackingCarrier: "usps", trackingNumber: "9400 1000 0000 0000 0000 00", shippingLabel: { test: false } });
    expect((await ratesHandler(req(order.id, PARCEL), { env: LIVE, fetch: s.fetch })).status).toBe(409);
  });

  it("refuses: no token, not staff, a pickup order, a TEST order with a live token, a rate from another shipment, a bad parcel", async () => {
    const order = await shippedOrder();
    const s = shippo();
    expect((await ratesHandler(req(order.id, PARCEL), { env: {}, fetch: s.fetch })).status).toBe(503);
    expect((await ratesHandler(req(order.id, PARCEL, null), { env: TEST, fetch: s.fetch })).status).toBe(403);
    expect((await ratesHandler(req(order.id, { ...PARCEL, weightLbs: "" }), { env: TEST, fetch: s.fetch })).status).toBe(400);
    await payload.update({ collection: "orders", id: order.id, data: { testMode: true } as never, overrideAccess: true });
    expect((await ratesHandler(req(order.id, PARCEL), { env: LIVE, fetch: s.fetch })).status).toBe(400);
    expect((await buyHandler(req(order.id, { rateId: "5".repeat(32) }), { env: TEST, fetch: s.fetch })).status).toBe(400); // no rates asked yet
    await ratesHandler(req(order.id, PARCEL), { env: TEST, fetch: s.fetch });
    expect((await buyHandler(req(order.id, { rateId: "5".repeat(32) }), { env: TEST, fetch: s.fetch })).status).toBe(502);
    expect(s.calls.some((c) => c.url.endsWith("/transactions/"))).toBe(false);

    const p = await makeProduct(w, { stock: 5, priceCents: 500 });
    const pick = await placeOrder(payload, { cartToken: await bagWith(w, p.id), form: { ...FORM, pickup: "2026-10-07|12:00" }, now: NOW }, w.ctx);
    if (!pick.ok) throw new Error(pick.error);
    const pickup = (await findByToken(payload, "orders", pick.number, pick.token)) as Order;
    expect((await ratesHandler(req(pickup.id, PARCEL), { env: TEST, fetch: s.fetch })).status).toBe(400);
  });
});

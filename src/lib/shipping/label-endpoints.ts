/**
 * The order admin's "Shipping label" endpoints (D66): staff only.
 *
 *   POST /api/orders/:id/shipping-rates  { lengthIn, widthIn, heightIn, weightLbs } → rates
 *   POST /api/orders/:id/buy-label       { rateId } → the label
 *
 * A test token (shippo_test_…) makes sample labels: the order keeps its status and tracking and no
 * email goes out, so a real customer is never sent a fake tracking number. A live token fills in the
 * carrier and tracking number and saves the order as Shipped, which sends the shipped email (D64).
 * A live label is bought once per order, and never for a test-payment order or one that isn't paid.
 */
import type { Endpoint, Payload, PayloadRequest } from "payload";

import { hasRole, ROLES } from "../../access/roles";
import { buyLabel, carrierOf, getRates, parseLocality, shippoSettingFrom, validParcel, type Address, type ShippoConfig } from "./shippo";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;
export type LabelDeps = { env?: Record<string, string | undefined>; fetch?: Fetch; now?: () => Date };

const json = (status: number, body: unknown) => Response.json(body, { status });

type OrderDoc = {
  id: number | string;
  number?: string;
  testMode?: boolean | null;
  paymentStatus?: string;
  customer?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  fulfillment?: { method?: string | null; shipTo?: { name?: string | null; line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null } | null;
  shippingLabel?: { shipmentId?: string | null; labelUrl?: string | null; test?: boolean | null } | null;
};

async function body(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    const b = req.json ? await req.json() : {};
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function load(req: PayloadRequest, deps: LabelDeps): Promise<{ ok: true; order: OrderDoc; config: ShippoConfig } | { ok: false; res: Response }> {
  if (!hasRole(req.user as never, ...ROLES)) return { ok: false, res: json(403, { error: "Staff only." }) };
  const setting = shippoSettingFrom(deps.env ?? process.env);
  if (setting.kind === "off") return { ok: false, res: json(503, { error: "Shipping labels aren't set up: add the Shippo API key (SHIPPO_API_TOKEN)." }) };
  if (setting.kind === "misconfigured") return { ok: false, res: json(503, { error: setting.reason }) };
  const id = String(req.routeParams?.id ?? "");
  if (!/^\d{1,12}$/.test(id)) return { ok: false, res: json(400, { error: "Unknown order." }) };
  const order = (await req.payload.findByID({ collection: "orders", id, depth: 0, overrideAccess: true }).catch(() => null)) as OrderDoc | null;
  if (!order) return { ok: false, res: json(404, { error: "Unknown order." }) };
  if (order.fulfillment?.method !== "ship" || !order.fulfillment.shipTo?.line1) return { ok: false, res: json(400, { error: "This order is for pickup: there's nothing to ship." }) };
  if (!setting.config.test) {
    if (order.testMode) return { ok: false, res: json(400, { error: "This is a TEST order: no real label is bought for it." }) };
    if (order.paymentStatus !== "paid") return { ok: false, res: json(400, { error: "This order isn't paid: buy a label once the payment shows Paid." }) };
    if (order.shippingLabel?.labelUrl && !order.shippingLabel.test) return { ok: false, res: json(409, { error: "A label was already bought for this order. Print it from the link below." }) };
  }
  return { ok: true, order, config: setting.config };
}

async function shopAddress(payload: Payload): Promise<Address | null> {
  const store = (await payload.findGlobal({ slug: "store-settings", depth: 0, overrideAccess: true })) as { name?: string; street?: string; locality?: string; phone?: string; email?: string };
  const where = parseLocality(store.locality ?? "");
  if (!where || !store.street) return null;
  return { name: (store.name ?? "Lodelicious").trim(), street1: store.street, ...where, country: "US", phone: store.phone, email: store.email };
}

function toAddress(order: OrderDoc): Address {
  const a = order.fulfillment?.shipTo ?? {};
  return {
    name: a.name || order.customer?.name || "",
    street1: a.line1 ?? "",
    street2: a.line2 ?? "",
    city: a.city ?? "",
    state: a.state ?? "",
    zip: a.zip ?? "",
    country: "US",
    phone: order.customer?.phone ?? "",
    email: order.customer?.email ?? "",
  };
}

export async function ratesHandler(req: PayloadRequest, deps: LabelDeps = {}): Promise<Response> {
  const loaded = await load(req, deps);
  if (!loaded.ok) return loaded.res;
  const parcel = validParcel(await body(req));
  if (!parcel) return json(400, { error: "Enter the box's length, width and height (inches) and the packed weight (pounds)." });
  const from = await shopAddress(req.payload);
  if (!from) return json(400, { error: 'The shop address in Settings → Store isn\'t complete: "Town, state and ZIP" must read like "Plymouth, MA 02360".' });
  const result = await getRates(deps.fetch ?? fetch, loaded.config, { from, to: toAddress(loaded.order), parcel, reference: `Order ${loaded.order.number ?? loaded.order.id}` });
  if (!result.ok) return json(502, { error: result.error });
  await req.payload.update({
    collection: "orders",
    id: loaded.order.id,
    data: { shippingLabel: { ...(loaded.order.shippingLabel ?? {}), shipmentId: result.value.shipmentId } } as never,
    overrideAccess: true,
    context: { shippoLabel: true },
  });
  return json(200, { test: loaded.config.test, rates: result.value.rates });
}

export async function buyHandler(req: PayloadRequest, deps: LabelDeps = {}): Promise<Response> {
  const loaded = await load(req, deps);
  if (!loaded.ok) return loaded.res;
  const shipmentId = loaded.order.shippingLabel?.shipmentId;
  if (!shipmentId) return json(400, { error: "Get rates first." });
  const result = await buyLabel(deps.fetch ?? fetch, loaded.config, { rateId: String((await body(req)).rateId ?? ""), shipmentId });
  if (!result.ok) return json(502, { error: result.error });
  const l = result.value;
  const label = {
    shipmentId,
    labelUrl: l.labelUrl,
    service: `${l.carrier} ${l.service}`.trim(),
    costCents: l.amountCents,
    transactionId: l.transactionId,
    labelTrackingNumber: l.trackingNumber,
    test: loaded.config.test,
    boughtAt: (deps.now?.() ?? new Date()).toISOString(),
  };
  const data: Record<string, unknown> = { shippingLabel: label };
  // Only a real label changes the order: carrier, tracking, Shipped (which emails the customer).
  if (!loaded.config.test) Object.assign(data, { trackingCarrier: carrierOf(l.carrier), trackingNumber: l.trackingNumber, fulfillmentStatus: "shipped" });
  await req.payload.update({ collection: "orders", id: loaded.order.id, data: data as never, overrideAccess: true, user: req.user, context: { shippoLabel: true } });
  return json(200, { test: loaded.config.test, label });
}

export const labelEndpoints: Endpoint[] = [
  { path: "/:id/shipping-rates", method: "post", handler: (req) => ratesHandler(req) },
  { path: "/:id/buy-label", method: "post", handler: (req) => buyHandler(req) },
];

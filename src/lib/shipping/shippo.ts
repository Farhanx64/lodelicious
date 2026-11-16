/**
 * Shipping labels through Shippo (D66). Framework free: `fetch` is passed in, so it is tested in Node.
 *
 * Flow, from the order's admin page:
 *   1. "Get rates": a Shippo shipment from the shop to the order's ship-to address, one parcel (the
 *      box and weight checkout picked, editable by staff). Shippo answers with carrier rates.
 *   2. Staff pick one; "Buy label" buys that rate (a Shippo transaction) and returns the tracking
 *      number and a 4×6 PDF label.
 *
 * Config: `SHIPPO_API_TOKEN` (a `shippo_test_…` token makes sample labels that cost nothing and can't
 * be mailed; `shippo_live_…` buys real postage on Lody's Shippo billing). The token goes only in the
 * Authorization header, never into a message or log line.
 */
import type { EnvLike } from "../app-env";
import type { Carrier } from "../email/tracking";

const API = "https://api.goshippo.com";

export type ShippoConfig = { token: string; test: boolean };
export type ShippoSetting = { kind: "off" } | { kind: "misconfigured"; reason: string } | { kind: "on"; config: ShippoConfig };

export function shippoSettingFrom(env: EnvLike): ShippoSetting {
  const token = (env.SHIPPO_API_TOKEN ?? "").trim();
  if (!token) return { kind: "off" };
  const m = /^shippo_(test|live)_[A-Za-z0-9]{20,80}$/.exec(token);
  if (!m) return { kind: "misconfigured", reason: "SHIPPO_API_TOKEN does not look like a Shippo API token" };
  return { kind: "on", config: { token, test: m[1] === "test" } };
}

export type Address = { name: string; street1: string; street2?: string; city: string; state: string; zip: string; country: "US"; phone?: string; email?: string };
export type Parcel = { lengthIn: number; widthIn: number; heightIn: number; weightLbs: number };

export type Rate = {
  id: string;
  carrier: string;
  service: string;
  amountCents: number;
  days: number | null;
};

export type ShippoResult<T> = { ok: true; value: T } | { ok: false; error: string };

const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, max);

/** "Plymouth, MA 02360" → city, state, zip; null when it doesn't read that way. */
export function parseLocality(locality: string): { city: string; state: string; zip: string } | null {
  const m = /^\s*(.+?),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/.exec(locality ?? "");
  return m ? { city: m[1].trim(), state: m[2].toUpperCase(), zip: m[3] } : null;
}

/** The box's dimensions from the order's "Box to pack" text ("Medium box, 16 × 10 × 16 in"). */
export function dimsFromBoxLabel(label: unknown): { lengthIn: number; widthIn: number; heightIn: number } | null {
  const m = /(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*in/i.exec(String(label ?? ""));
  return m ? { lengthIn: Number(m[1]), widthIn: Number(m[2]), heightIn: Number(m[3]) } : null;
}

/** A parcel staff can ship: every size above 0 and at most 108 in, weight above 0 and at most 150 lb. */
export function validParcel(p: Partial<Record<keyof Parcel, unknown>>): Parcel | null {
  const n = (v: unknown, max: number) => {
    const x = typeof v === "string" ? Number(v) : v;
    return typeof x === "number" && Number.isFinite(x) && x > 0 && x <= max ? Math.round(x * 100) / 100 : null;
  };
  const lengthIn = n(p.lengthIn, 108);
  const widthIn = n(p.widthIn, 108);
  const heightIn = n(p.heightIn, 108);
  const weightLbs = n(p.weightLbs, 150);
  return lengthIn && widthIn && heightIn && weightLbs ? { lengthIn, widthIn, heightIn, weightLbs } : null;
}

/** Shippo's carrier name as one of the tracking carriers the shipped email knows. */
export function carrierOf(provider: string): Carrier {
  const p = provider.toLowerCase();
  if (p.includes("usps")) return "usps";
  if (p.includes("ups")) return "ups";
  if (p.includes("fedex")) return "fedex";
  return "other";
}

const toCents = (amount: unknown): number | null => {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(amount ?? "").trim());
  return m ? Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0")) : null;
};

/** Shippo's first error message, cut short, or a fallback. Never includes the token. */
function messageOf(body: unknown, fallback: string): string {
  const b = (body ?? {}) as { messages?: { text?: unknown }[]; detail?: unknown };
  const text = b.messages?.map((m) => clean(m?.text, 200)).find(Boolean) ?? clean(b.detail, 200);
  return text || fallback;
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

async function call(fetch: Fetch, config: ShippoConfig, path: string, method: "GET" | "POST", body?: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `ShippoToken ${config.token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed };
}

const addressBody = (a: Address) => ({
  name: clean(a.name, 100),
  street1: clean(a.street1, 120),
  street2: clean(a.street2, 120),
  city: clean(a.city, 60),
  state: clean(a.state, 2),
  zip: clean(a.zip, 10),
  country: "US",
  phone: clean(a.phone, 30),
  email: clean(a.email, 200),
});

/** Asks Shippo for rates for one parcel. Cheapest first. */
export async function getRates(
  fetch: Fetch,
  config: ShippoConfig,
  input: { from: Address; to: Address; parcel: Parcel; reference: string },
): Promise<ShippoResult<{ shipmentId: string; rates: Rate[] }>> {
  const { status, body } = await call(fetch, config, "/shipments/", "POST", {
    address_from: addressBody(input.from),
    address_to: addressBody(input.to),
    parcels: [
      {
        length: String(input.parcel.lengthIn),
        width: String(input.parcel.widthIn),
        height: String(input.parcel.heightIn),
        distance_unit: "in",
        weight: String(input.parcel.weightLbs),
        mass_unit: "lb",
      },
    ],
    metadata: clean(input.reference, 100),
    async: false,
  });
  if (status >= 400) return { ok: false, error: `Shippo refused the shipment: ${messageOf(body, `HTTP ${status}`)}` };
  const b = (body ?? {}) as { object_id?: unknown; rates?: unknown[] };
  if (typeof b.object_id !== "string") return { ok: false, error: "Shippo didn't return a shipment." };
  const rates = (b.rates ?? []).flatMap((r): Rate[] => {
    const x = (r ?? {}) as { object_id?: unknown; provider?: unknown; servicelevel?: { name?: unknown }; amount?: unknown; currency?: unknown; estimated_days?: unknown };
    const cents = toCents(x.amount);
    if (typeof x.object_id !== "string" || cents === null || (x.currency && x.currency !== "USD")) return [];
    return [{ id: x.object_id, carrier: clean(x.provider, 40), service: clean(x.servicelevel?.name, 80), amountCents: cents, days: typeof x.estimated_days === "number" ? x.estimated_days : null }];
  });
  rates.sort((a, b) => a.amountCents - b.amountCents);
  if (rates.length === 0) return { ok: false, error: `No rates for this address and parcel. ${messageOf(body, "Check the address, box size and weight.")}` };
  return { ok: true, value: { shipmentId: b.object_id, rates } };
}

export type Label = { transactionId: string; trackingNumber: string; labelUrl: string; carrier: string; service: string; amountCents: number };

/** Buys one rate, after checking it belongs to `shipmentId` (the shipment this order asked about). */
export async function buyLabel(fetch: Fetch, config: ShippoConfig, input: { rateId: string; shipmentId: string }): Promise<ShippoResult<Label>> {
  if (!/^[a-f0-9]{32}$/.test(input.rateId)) return { ok: false, error: "That rate isn't valid. Get rates again." };
  const rate = await call(fetch, config, `/rates/${input.rateId}`, "GET");
  const r = (rate.body ?? {}) as { shipment?: unknown; provider?: unknown; servicelevel?: { name?: unknown }; amount?: unknown };
  if (rate.status >= 400 || r.shipment !== input.shipmentId) return { ok: false, error: "That rate is not for this order's shipment. Get rates again." };
  const { status, body } = await call(fetch, config, "/transactions/", "POST", { rate: input.rateId, label_file_type: "PDF_4x6", async: false });
  const t = (body ?? {}) as { object_id?: unknown; status?: unknown; tracking_number?: unknown; label_url?: unknown };
  if (status >= 400 || t.status !== "SUCCESS" || typeof t.label_url !== "string" || !t.label_url.startsWith("https://")) {
    return { ok: false, error: `Shippo couldn't buy the label: ${messageOf(body, `HTTP ${status}`)}` };
  }
  return {
    ok: true,
    value: {
      transactionId: clean(t.object_id, 64),
      trackingNumber: clean(t.tracking_number, 64),
      labelUrl: t.label_url,
      carrier: clean(r.provider, 40),
      service: clean(r.servicelevel?.name, 80),
      amountCents: toCents(r.amount) ?? 0,
    },
  };
}

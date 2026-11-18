/**
 * Live shipping prices at checkout (D67). The box and weight come from the bag (D60); Shippo prices
 * that parcel from the shop to the customer's ZIP, and checkout charges the cheapest carrier rate. The checkout page asks for the same figure as soon as a ZIP is typed, so the
 * total the customer sees is the total the server charges.
 *
 * There is no flat-rate fallback on the live store: when Shippo can't price the parcel (no weight,
 * Shippo down or slow), shipping isn't offered for that try and the customer can retry or pick up.
 * An order heavier than every box is priced in the largest box at its real weight. Only where
 * Shippo isn't set up at all (local, tests, `SHIPPO_CHECKOUT_RATES=off`) do the D54 rules apply.
 */
import type { Payload } from "payload";

import type { Packing, ShipBox } from "./boxes";
import { checkoutRate, getRates, parseLocality, shippoSettingFrom, type Address } from "./shippo";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Prices one packed parcel to a ZIP; null means "use the usual rules". */
/** `boxes` lets an order heavier than every box be priced in the largest one. */
export type LiveRater = (packing: Packing, to: { zip: string; state: string }, boxes?: readonly ShipBox[]) => Promise<number | null>;

const ZIP = /^\d{5}$/;
const TIMEOUT_MS = 8_000;

/**
 * Packing and handling added to every live shipping price (owner, 2026-11-17): part of the one
 * "Shipping" figure the customer sees, never a separate line. `SHIPPING_HANDLING_CENTS` overrides it.
 */
export const DEFAULT_HANDLING_CENTS = 200;

export function handlingCentsFrom(env: Record<string, string | undefined>): number {
  const raw = (env.SHIPPING_HANDLING_CENTS ?? "").trim();
  return /^\d{1,5}$/.test(raw) ? Number(raw) : DEFAULT_HANDLING_CENTS;
}

export async function shopFromAddress(payload: Payload): Promise<Address | null> {
  const store = (await payload.findGlobal({ slug: "store-settings", depth: 0, overrideAccess: true })) as { name?: string; street?: string; locality?: string; phone?: string; email?: string };
  const where = parseLocality(store.locality ?? "");
  if (!where || !store.street) return null;
  return { name: (store.name ?? "Lodelicious").trim(), street1: store.street, ...where, country: "US", phone: store.phone, email: store.email };
}

/** The live rater for this environment, or null when checkout keeps the D54 rules. */
export function liveRaterFrom(env: Record<string, string | undefined>, from: Address | null, fetchImpl: Fetch = fetch): LiveRater | null {
  const setting = shippoSettingFrom(env);
  if (setting.kind !== "on" || !from || (env.SHIPPO_CHECKOUT_RATES ?? "").trim().toLowerCase() === "off") return null;
  const handling = handlingCentsFrom(env);
  return async (packing, to, boxes = []) => {
    const zip = String(to.zip ?? "").trim().slice(0, 5);
    const largest = [...boxes].sort((a, b) => b.maxWeightLbs - a.maxWeightLbs)[0];
    const box = packing.box ?? (packing.reason === "too_heavy" ? largest : undefined);
    const weightLbs = packing.box ? packing.weightLbs : packing.reason === "too_heavy" ? packing.weightLbs : 0;
    if (!box || !(weightLbs > 0) || !ZIP.test(zip)) return null;
    const timed: Fetch = (url, init) => fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    try {
      const result = await getRates(timed, setting.config, {
        from,
        to: { zip, state: String(to.state ?? "").trim().toUpperCase().slice(0, 2) },
        parcel: { lengthIn: box.lengthIn || 12, widthIn: box.widthIn || 9, heightIn: box.heightIn || 6, weightLbs },
        reference: "checkout quote",
      });
      if (!result.ok) return null;
      const rate = checkoutRate(result.value.rates);
      return rate ? rate.amountCents + handling : null;
    } catch {
      return null;
    }
  };
}

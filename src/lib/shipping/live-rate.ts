/**
 * Live shipping prices at checkout (D67). The box and weight come from the bag (D60); Shippo prices
 * that parcel from the shop to the customer's ZIP, and checkout charges the cheapest carrier rate. The checkout page asks for the same figure as soon as a ZIP is typed, so the
 * total the customer sees is the total the server charges.
 *
 * Falls back to the D54 rules (flat rate or basket size) when: Shippo isn't set up or is switched off
 * (`SHIPPO_CHECKOUT_RATES=off`), the bag has no box (an item without a weight, or heavier than the
 * largest box), or Shippo doesn't answer in time. A customer is never stopped by Shippo.
 */
import type { Payload } from "payload";

import type { Packing } from "./boxes";
import { checkoutRate, getRates, parseLocality, shippoSettingFrom, type Address } from "./shippo";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Prices one packed parcel to a ZIP; null means "use the usual rules". */
export type LiveRater = (packing: Packing, to: { zip: string; state: string }) => Promise<number | null>;

const ZIP = /^\d{5}$/;
const TIMEOUT_MS = 8_000;

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
  return async (packing, to) => {
    const zip = String(to.zip ?? "").trim().slice(0, 5);
    if (!packing.box || !ZIP.test(zip)) return null;
    const timed: Fetch = (url, init) => fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    try {
      const box = packing.box;
      const result = await getRates(timed, setting.config, {
        from,
        to: { zip, state: String(to.state ?? "").trim().toUpperCase().slice(0, 2) },
        parcel: { lengthIn: box.lengthIn || 12, widthIn: box.widthIn || 9, heightIn: box.heightIn || 6, weightLbs: packing.weightLbs },
        reference: "checkout quote",
      });
      if (!result.ok) return null;
      return checkoutRate(result.value.rates)?.amountCents ?? null;
    } catch {
      return null;
    }
  };
}

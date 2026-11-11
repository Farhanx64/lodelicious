/** What the customer pays for delivery, given the courier's fee. Pure, integer cents. */
import type { Cents } from "../money";

export type DeliveryPricing = {
  /** Flat amount added on top of the courier fee. */
  markupCents: Cents;
  /** Customer pays nothing for delivery at or above this subtotal. Null = never free. */
  freeOverCents: Cents | null;
  /** Orders below this subtotal can't be delivered. */
  minimumCents: Cents;
};

export type CustomerFee = { eligible: true; feeCents: Cents } | { eligible: false; reason: "below_minimum" };

export function customerDeliveryFee(courierFeeCents: Cents, subtotalCents: Cents, p: DeliveryPricing): CustomerFee {
  if (subtotalCents < p.minimumCents) return { eligible: false, reason: "below_minimum" };
  if (p.freeOverCents !== null && subtotalCents >= p.freeOverCents) return { eligible: true, feeCents: 0 };
  return { eligible: true, feeCents: courierFeeCents + p.markupCents };
}

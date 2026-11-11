/**
 * The seam between checkout and a last-mile courier (DoorDash Drive, Uber Direct). Checkout only knows
 * this interface. Framework free, integer cents (see ../money.ts).
 *
 * Flow: quote() at checkout → customer sees the fee → after payment succeeds, dispatch() →
 * the courier's webhook feeds `DeliveryEvent`s → cancel() if staff cancel before pickup.
 *
 * SKETCH: the real HTTP adapters (http-doordash.ts, http-uber.ts) are not written. Their endpoints and
 * auth must be verified against each provider's developer docs and sandbox first.
 */
import type { Cents } from "../money";

export type DeliveryAddress = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  /** Delivery-contact phone, E.164. Couriers call it. */
  phone: string;
  name: string;
  instructions?: string;
};

export type QuoteRequest = {
  dropoff: DeliveryAddress;
  /** Order value, for courier insurance and minimums. */
  orderValueCents: Cents;
  /** Earliest the bag is ready. Null = as soon as possible. */
  readyAt: Date | null;
};

export type Quote = {
  provider: string;
  /** Provider's quote id. Dispatch must reference it so the customer is charged what they saw. */
  quoteId: string;
  /** What the courier will bill the store. */
  courierFeeCents: Cents;
  /** Quote stops being valid here (Uber quotes last about 15 minutes). */
  expiresAt: Date;
  estimatedDropoffAt: Date | null;
};

export type DispatchRequest = {
  quote: Quote;
  /** Our order number, shown to the driver. */
  orderNumber: string;
  dropoff: DeliveryAddress;
  /** Stable per order, so a retry can never create a second delivery. */
  idempotencyKey: string;
  items: { name: string; quantity: number }[];
};

export type DeliveryStatus = "created" | "driver_assigned" | "picked_up" | "delivered" | "cancelled" | "failed" | "returned";

export type Delivery = {
  provider: string;
  deliveryId: string;
  status: DeliveryStatus;
  trackingUrl: string | null;
};

/** Normalised webhook payload, after signature verification. */
export type DeliveryEvent = { provider: string; deliveryId: string; status: DeliveryStatus; at: Date; driverName?: string };

export type DeliveryErrorKind = "no_coverage" | "too_far" | "quote_expired" | "rate_limited" | "timeout" | "server" | "auth" | "rejected" | "config";

export class DeliveryError extends Error {
  constructor(
    message: string,
    readonly kind: DeliveryErrorKind,
  ) {
    super(message);
    this.name = "DeliveryError";
  }
  /** Worth retrying later. The rest need a human or a new quote. */
  get transient(): boolean {
    return this.kind === "rate_limited" || this.kind === "timeout" || this.kind === "server";
  }
}

export interface DeliveryAdapter {
  readonly id: "doordash" | "uber" | "fake";
  quote(req: QuoteRequest): Promise<Quote>;
  /** Exactly once per idempotency key. A timeout is "unknown": reconcile with getDelivery, never re-create blindly. */
  dispatch(req: DispatchRequest): Promise<Delivery>;
  getDelivery(deliveryId: string): Promise<Delivery>;
  cancel(deliveryId: string): Promise<Delivery>;
}

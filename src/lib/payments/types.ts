/** The payment provider seam (D35, D42, D54). Framework free, integer cents. */
import type { Cents } from "../money";
import type { ShippingAddress } from "../shipping/rates";

/**
 * What the provider is told about the order, so the record it keeps (a Clover order on Lody's
 * account) has the items and how the customer gets them. Lines are net of any reward discount;
 * quantity is folded into each description so the cents stay exact.
 */
export type ChargeOrderDetails = {
  email: string;
  customerName: string;
  phone: string;
  lines: { description: string; amountCents: Cents; taxCents: Cents; taxName: string; taxRateBasisPoints?: number | null }[];
  shippingCents: Cents;
  /** "Pickup Tuesday, October 6, 11:00 AM–12:00 PM" or "Ship to …". */
  fulfillmentNote: string;
  customerNote?: string;
  shipTo?: ShippingAddress | null;
  /** The whole order's total. A reservation deposit charges less than this; the rest is due later. */
  orderTotalCents: Cents;
};

export type ChargeInput = {
  reference: string;
  amountCents: Cents;
  idempotencyKey: string;
  /** The single-use card token from the provider's browser fields (Clover: `clv_…`). */
  source?: string;
  /** The customer's IP, which Clover asks for on every ecommerce call. */
  clientIp?: string;
  order?: ChargeOrderDetails;
  /** Called as soon as the provider has an order id, before any money moves, so it is saved for reconciliation. */
  onProviderOrder?: (providerOrderId: string) => Promise<void>;
};

/**
 * "unknown" means the provider did not say (timeout, dropped connection, pending review): the
 * customer may or may not have been charged, so checkout never charges again until staff reconcile (D42).
 */
export type ChargeResult = { status: "paid" | "failed" | "unknown"; reference: string; message?: string; providerOrderId?: string };

export type LookupResult = { status: "paid"; reference: string } | { status: "not_paid" } | { status: "unknown" };

/** What the checkout page needs in the browser to show the card fields. Never a secret. */
export type BrowserPaymentConfig =
  | { kind: "test" }
  | {
      kind: "clover";
      sdkUrl: string;
      publicKey: string;
      merchantId: string | null;
      /** Offer Clover's Apple Pay button (D59), where the device has Apple Pay. */
      applePay?: boolean;
      /** Offer Clover's Google Pay button (D63), where Apple Pay isn't shown. */
      googlePay?: boolean;
    };

export type PaymentProvider = {
  id: string;
  /** No real money moves (the staging test provider, or Clover's sandbox). */
  test: boolean;
  /** The customer must enter a card in the provider's fields before submitting. Absent means no. */
  needsCardToken?: boolean;
  /** What the checkout page shows for the card. Absent means the test placeholder. */
  browser?: BrowserPaymentConfig;
  charge(input: ChargeInput): Promise<ChargeResult>;
  /** Read-only check of an earlier payment, for reconciling "unknown" ones. */
  lookup?(providerOrderId: string, expectedPaidCents: Cents): Promise<LookupResult>;
};

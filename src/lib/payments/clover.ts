/**
 * Clover Ecommerce payments (D54): the card is typed into Clover's own iframes on our checkout page
 * and turned into a single-use token (`clv_…`) in the browser, so card data never reaches our
 * servers. The server then
 *
 *   1. creates a Clover ecommerce order (POST /v1/orders) with the line items, tax, shipping, the
 *      customer's name, email and phone, and the pickup time or shipping address, so the order
 *      reaches Lody's Clover account with everything staff need, and
 *   2. pays it with the token (POST /v1/orders/{id}/pay).
 *
 * Every POST carries an `idempotency-key` derived from the record's key and attempt number (D42),
 * so a retry after a crash is the same order and the same payment, never a second charge.
 *
 * Outcomes:
 *   - Anything that fails BEFORE the pay call (bad config, order refused, Clover down, the order total
 *     not matching ours) charged nothing: "failed".
 *   - A clear decline from the pay call: "failed".
 *   - No clear answer from the pay call (timeout, 5xx, rate limit, a status we don't recognise):
 *     thrown, which `chargeSafely` turns into "unknown" — staff reconcile it, and `lookup` lets the
 *     cron job confirm it from Clover (reconcile.ts).
 *
 * The private token is sent only in the Authorization header and never appears in a message or
 * log line. Written from Clover's public docs (2026-11-11); see D54 for what must still be checked
 * in the sandbox.
 */
import { CLOVER_NO_TAX_RATE } from "../checkout/ship-tax";
import type { Cents } from "../money";
import type { ChargeInput, ChargeResult, LookupResult, PaymentProvider } from "./types";

export type CloverEnvironment = "sandbox" | "production";

export const CLOVER_HOSTS: Record<CloverEnvironment, { api: string; sdk: string }> = {
  sandbox: { api: "https://scl-sandbox.dev.clover.com", sdk: "https://checkout.sandbox.dev.clover.com/sdk.js" },
  production: { api: "https://scl.clover.com", sdk: "https://checkout.clover.com/sdk.js" },
};

export type CloverConfig = {
  environment: CloverEnvironment;
  publicKey: string;
  privateToken: string;
  /** Clover's merchant id (not secret). The iframe SDK asks for it for some features; optional. */
  merchantId: string | null;
  /**
   * Offer Apple Pay through Clover's iframe (D59): `CLOVER_ECOMM_APPLE_PAY=on`, and only with a
   * merchant id, which Clover's Apple Pay button needs as its session identifier. Off until the
   * domain is verified with Clover, so Safari never shows a button that can't work.
   */
  applePay?: boolean;
  /**
   * Offer Google Pay through Clover's iframe (D63): `CLOVER_ECOMM_GOOGLE_PAY=on`, and only with a
   * merchant id (Clover's frame gets the merchant's Google Pay setting through it). Off until Clover
   * shows Google Pay enabled for the account.
   */
  googlePay?: boolean;
};

export class CloverConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloverConfigError";
  }
}

type EnvLike = Record<string, string | undefined>;

const VARS = ["CLOVER_ECOMM_PUBLIC_KEY", "CLOVER_ECOMM_PRIVATE_TOKEN", "CLOVER_ECOMM_ENVIRONMENT"] as const;

/** True when any Clover payments variable is set (so a half-done setup is reported, not ignored). */
export function cloverPaymentsRequested(env: EnvLike): boolean {
  return VARS.some((k) => (env[k] ?? "").trim() !== "");
}

/** Reads the Clover payment settings, or throws a CloverConfigError naming what is missing (never a value). */
export function cloverConfigFrom(env: EnvLike): CloverConfig {
  const get = (k: string) => (env[k] ?? "").trim();
  const missing = VARS.filter((k) => !get(k));
  if (missing.length) throw new CloverConfigError(`Clover payments need ${missing.join(", ")}`);
  const environment = get("CLOVER_ECOMM_ENVIRONMENT").toLowerCase();
  if (environment !== "sandbox" && environment !== "production") throw new CloverConfigError('CLOVER_ECOMM_ENVIRONMENT must be "sandbox" or "production"');
  const publicKey = get("CLOVER_ECOMM_PUBLIC_KEY");
  const privateToken = get("CLOVER_ECOMM_PRIVATE_TOKEN");
  if (!/^[\w-]{8,200}$/.test(publicKey)) throw new CloverConfigError("CLOVER_ECOMM_PUBLIC_KEY does not look like a Clover public key");
  if (!/^[\w-]{8,200}$/.test(privateToken)) throw new CloverConfigError("CLOVER_ECOMM_PRIVATE_TOKEN does not look like a Clover private token");
  if (publicKey === privateToken) throw new CloverConfigError("CLOVER_ECOMM_PUBLIC_KEY and CLOVER_ECOMM_PRIVATE_TOKEN are the same value");
  const merchantId = get("CLOVER_ECOMM_MERCHANT_ID");
  if (merchantId && !/^[A-Z0-9]{8,20}$/.test(merchantId)) throw new CloverConfigError("CLOVER_ECOMM_MERCHANT_ID does not look like a Clover merchant id");
  const on = (k: string) => ["on", "true", "1", "yes"].includes(get(k).toLowerCase()) && merchantId !== "";
  return { environment, publicKey, privateToken, merchantId: merchantId || null, applePay: on("CLOVER_ECOMM_APPLE_PAY"), googlePay: on("CLOVER_ECOMM_GOOGLE_PAY") };
}

/** A single-use card token from Clover's iframe. */
export const CARD_TOKEN = /^clv_[\w-]{4,200}$/;

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{
  status: number;
  json(): Promise<unknown>;
}>;

/** A Clover answer that is not success. `charged` says whether money may have moved. */
class CloverCallError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly type: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "CloverCallError";
  }
}

const REQUEST_TIMEOUT_MS = 20_000;

type CloverOrder = { id?: unknown; status?: unknown; amount?: unknown; amount_paid?: unknown; charge?: unknown };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);

/** Message safe to show staff: Clover's own text with anything secret-looking removed and capped. */
function cleanMessage(text: unknown): string {
  return str(text).replace(/(Bearer\s+)?[\w-]{24,}/g, "[redacted]").replace(/\s+/g, " ").trim().slice(0, 200);
}

export class CloverPaymentProvider implements PaymentProvider {
  readonly id = "clover";
  readonly test: boolean;
  readonly needsCardToken = true;
  private readonly fetchImpl: FetchLike;

  constructor(
    private readonly config: CloverConfig,
    opts: { fetch?: FetchLike; userAgent?: string } = {},
  ) {
    this.test = config.environment === "sandbox";
    this.fetchImpl = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
    this.userAgent = opts.userAgent ?? "lodelicious-store/1.0";
  }
  private readonly userAgent: string;

  get browser() {
    return {
      kind: "clover" as const,
      sdkUrl: CLOVER_HOSTS[this.config.environment].sdk,
      publicKey: this.config.publicKey,
      merchantId: this.config.merchantId,
      applePay: this.config.applePay ?? false,
      googlePay: this.config.googlePay ?? false,
    };
  }

  private async call(method: "GET" | "POST", path: string, body: unknown, extra: { idempotencyKey?: string; clientIp?: string }): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.config.privateToken}`,
      accept: "application/json",
      "user-agent": this.userAgent,
    };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (extra.idempotencyKey) headers["idempotency-key"] = extra.idempotencyKey;
    if (extra.clientIp) headers["x-forwarded-for"] = extra.clientIp;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetchImpl(`${CLOVER_HOSTS[this.config.environment].api}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
    } catch (e) {
      throw new CloverCallError(`network error: ${cleanMessage((e as Error)?.message) || "no answer"}`, 0, "api_connection_error", "network");
    } finally {
      clearTimeout(timer);
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status >= 200 && res.status < 300) return data;
    const err = (data.error ?? {}) as Record<string, unknown>;
    throw new CloverCallError(cleanMessage(err.message) || `HTTP ${res.status}`, res.status, str(err.type), str(err.code) || str(err.decline_code));
  }

  /** The name of the merchant's tax rate in Clover (CLOVER_TAX_RATE_NAME, default "Sales Tax"). */
  private get taxRateName() {
    return (process.env.CLOVER_TAX_RATE_NAME || "Sales Tax").slice(0, 60);
  }

  /** The Clover order body: one line per bag line (quantity folded into the description so discounts stay exact). */
  private orderBody(input: ChargeInput) {
    const o = input.order;
    if (!o) throw new CloverConfigError("Clover payments need the order details");
    const metadata: Record<string, string> = {
      website_number: input.reference.slice(0, 40),
      customer_name: o.customerName.slice(0, 100),
      customer_phone: o.phone.slice(0, 30),
      fulfillment: o.fulfillmentNote.slice(0, 300),
      ...(o.customerNote ? { customer_note: o.customerNote.slice(0, 300) } : {}),
    };
    const untaxed = o.tax?.kind === "none";
    const rateName = (o.tax?.kind === "named" && o.tax.cloverTaxName ? o.tax.cloverTaxName : this.taxRateName).slice(0, 60);
    return {
      currency: "usd",
      email: o.email,
      items: [
        ...o.lines.map((l) => ({
          type: "sku",
          amount: l.amountCents,
          currency: "usd",
          quantity: 1,
          description: l.description.slice(0, 1000),
          // Clover matches each line's tax to one of the merchant's own tax rates by name and rate
          // (rate in Clover units: 6.25% = 625000), not by amount. Lody's Clover rate is "Sales Tax".
          // An order shipped outside the states the shop collects for carries Clover's zero rate
          // (NO_TAX_APPLIED, D65), so Clover can't put its default tax back on.
          ...(untaxed
            ? { tax_rates: [{ name: CLOVER_NO_TAX_RATE, rate: 0 }] }
            : l.taxCents > 0
              ? { tax_rates: [{ name: rateName, rate: cloverTaxRate(l.taxRateBasisPoints, l.amountCents, l.taxCents) }] }
              : {}),
        })),
        ...(o.shippingCents > 0 ? [{ type: "shipping", amount: o.shippingCents, currency: "usd", quantity: 1, description: "Shipping" }] : []),
      ],
      ...(o.shipTo
        ? {
            shipping: {
              name: o.shipTo.name,
              phone: o.phone,
              address: { line1: o.shipTo.line1, ...(o.shipTo.line2 ? { line2: o.shipTo.line2 } : {}), city: o.shipTo.city, state: o.shipTo.state, postal_code: o.shipTo.zip, country: "US" },
            },
          }
        : {}),
      metadata,
    };
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) return { status: "failed", reference: "", message: "Invalid amount" };
    if (!input.source || !CARD_TOKEN.test(input.source)) return { status: "failed", reference: "", message: "Please enter your card details." };
    const o = input.order;
    if (!o) return { status: "failed", reference: "", message: "Missing order details" };

    // 1. The order. Nothing has been charged yet, so any problem here is a plain failure.
    let order: CloverOrder;
    try {
      order = (await this.call("POST", "/v1/orders", this.orderBody(input), { idempotencyKey: `${input.idempotencyKey}:order`, clientIp: input.clientIp })) as CloverOrder;
    } catch (e) {
      const err = e as CloverCallError;
      console.error(`[payment] ${input.reference}: Clover refused the order (${err.status || "no answer"} ${err.type || ""}); nothing was charged`);
      return { status: "failed", reference: "", message: "We couldn't reach the card processor. Nothing was charged — please try again in a moment." };
    }
    const orderId = str(order.id);
    if (!/^[\w-]{4,64}$/.test(orderId)) {
      return { status: "failed", reference: "", message: "The card processor gave an unexpected answer. Nothing was charged — please try again." };
    }
    await input.onProviderOrder?.(orderId);
    // Our total and Clover's must agree to the cent, or the customer would be charged a different amount.
    const cloverTotal = num(order.amount);
    if (Number.isFinite(cloverTotal) && cloverTotal !== o.orderTotalCents) {
      console.error(`[payment] ${input.reference}: Clover order total ${cloverTotal} differs from ours ${o.orderTotalCents}; not charging`);
      return { status: "failed", reference: orderId, providerOrderId: orderId, message: "We couldn't total your order with the card processor. Nothing was charged — please call us." };
    }

    // 2. The payment. From here an unclear answer may mean the card was charged.
    const partial = input.amountCents < o.orderTotalCents;
    let paid: CloverOrder;
    try {
      paid = (await this.call(
        "POST",
        `/v1/orders/${encodeURIComponent(orderId)}/pay`,
        { source: input.source, email: o.email, ecomind: "ecom", ...(partial ? { amount: input.amountCents } : {}) },
        { idempotencyKey: `${input.idempotencyKey}:pay`, clientIp: input.clientIp },
      )) as CloverOrder;
    } catch (e) {
      const err = e as CloverCallError;
      if (err.code === "order_already_paid") return { status: "paid", reference: orderId, providerOrderId: orderId };
      if (err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 409 && err.status !== 429 && err.type !== "api_error" && err.type !== "rate_limit_error") {
        // A clear refusal: declined card, bad token, invalid request. Nothing was charged.
        return { status: "failed", reference: orderId, providerOrderId: orderId, message: declineMessage(err) };
      }
      // Timeout, network, 5xx, rate limit: we don't know. Thrown so the record is kept "unknown".
      throw Object.assign(new Error(`Clover pay call had no clear answer (${err.status || "no answer"} ${err.type || "network"})`), { providerOrderId: orderId });
    }
    const status = str(paid.status);
    const charge = str(paid.charge) || orderId;
    if (status === "paid" || (partial && status === "partially_paid" && num(paid.amount_paid) >= input.amountCents)) {
      return { status: "paid", reference: charge, providerOrderId: orderId };
    }
    // A 200 that doesn't say paid: the customer may or may not have been charged.
    return { status: "unknown", reference: charge, providerOrderId: orderId, message: `Clover answered with order status "${status || "none"}"` };
  }

  /** Whether a Clover order is paid now (for reconciling an unknown payment). Read only. */
  async lookup(providerOrderId: string, expectedPaidCents: Cents): Promise<LookupResult> {
    if (!/^[\w-]{4,64}$/.test(providerOrderId)) return { status: "unknown" };
    try {
      const order = (await this.call("GET", `/v1/orders/${encodeURIComponent(providerOrderId)}`, undefined, {})) as CloverOrder;
      const status = str(order.status);
      const amountPaid = num(order.amount_paid);
      if (status === "paid" || (Number.isFinite(amountPaid) && amountPaid >= expectedPaidCents && expectedPaidCents > 0)) {
        return { status: "paid", reference: str(order.charge) || providerOrderId };
      }
      if (status === "created" || status === "canceled") return { status: "not_paid" };
      return { status: "unknown" };
    } catch {
      return { status: "unknown" };
    }
  }
}

/** What the customer sees after a decline. Never Clover's raw text. */
function declineMessage(err: CloverCallError): string {
  switch (err.code) {
    case "expired_card":
      return "Your card has expired. Please use another card.";
    case "incorrect_cvc":
    case "invalid_cvc":
      return "The security code didn't match. Please check it and try again.";
    case "incorrect_number":
    case "invalid_number":
      return "The card number didn't go through. Please check it and try again.";
    case "token_already_used":
      return "Please enter your card details again and retry.";
    default:
      return err.type === "card_error" ? "Your card was declined. Please try another card." : "The payment didn't go through. Please check your card details and try again.";
  }
}

/** A tax rate in Clover's units (percent × 100000, so 6.25% = 625000). Falls back to the line's own ratio. */
export function cloverTaxRate(basisPoints: number | null | undefined, amountCents: number, taxCents: number): number {
  if (typeof basisPoints === "number" && basisPoints > 0) return Math.round(basisPoints * 1000);
  return amountCents > 0 ? Math.round(((taxCents / amountCents) * 10_000_000) / 1000) * 1000 : 0;
}

/**
 * Google Pay through Clover's iframe SDK (D63). Framework free, so it is tested with fakes in Node;
 * `components/checkout/GooglePayButton.tsx` is the thin React wrapper around it.
 *
 * Clover's flow, read from Clover's own code (checkout.clover.com `sdk.js` and the
 * `account-address-element_29.entry.js` frame bundle, downloaded 2026-11-14):
 *   1. `elements.create("PAYMENT_REQUEST_BUTTON", { paymentReqData })` on the page's one elements
 *      factory (the SDK throws without `paymentReqData`); `paymentReqData` is the frame's
 *      "cloverPaymentRequest": `total { label, amount }` with the amount in **cents** (the frame's
 *      `getTransactionInfo` turns 2550 into "25.50"), `currency`, `merchantName`, and `options`
 *      (`totalPriceStatus`, `button { buttonType, buttonColor }`). Clover uses its own Google
 *      merchant id and the `clover` gateway; we never see either.
 *   2. The frame asks the intermediate frame for the merchant's ecommerce config (only sent when the
 *      Clover instance has a merchant id), loads Google's pay.js and calls `isReadyToPay`. If the
 *      config says `gpay.supported` is false or Google says no, it posts `removeGooglePayFromDom`
 *      and the SDK deletes the iframe. It never says when the button *has* rendered.
 *   3. The customer pays in Google's sheet; the frame tokenizes with Clover and posts
 *      `onTokenizedWallet`; the SDK calls the element's `paymentMethod` listener with
 *      `{ card, token, customer: { email, billingInfo } }` (`token` is a `clv_` id), or an error object.
 *      `paymentMethodStart` / `paymentMethodEnd` (`{ status: "TOKENIZED" | "CANCELLED" }`) bracket the
 *      sheet; we don't need them (a cancelled sheet sends no token and charges nothing).
 *   4. We charge that token exactly like a card token. Google's sheet is already closed: no status call.
 *   5. `clover.updateGPayPaymentRequest({ total })` changes the amount later (merged into the request).
 *
 * Nothing here has run against Clover or with a real Google Pay account: see D63.
 */
import { applePayAvailable, type WalletOutcome, type WindowLike as AppleWindowLike } from "./apple-pay";
import { CARD_TOKEN } from "./clover";

export const GOOGLE_PAY_ELEMENT = "PAYMENT_REQUEST_BUTTON";
/** The title Clover's SDK gives the button's iframe, and names in `removeGooglePayFromDom`. */
export const GOOGLE_PAY_FRAME_TITLE = "PAYMENT REQUEST BUTTON";
export const CLOVER_FRAME_ORIGINS = ["https://checkout.clover.com", "https://checkout.sandbox.dev.clover.com"] as const;
export const GOOGLE_PAY_SCRIPT = "https://pay.google.com/gp/p/js/pay.js";

const LABEL = "Lodelicious";

/** The parts of a Clover instance Google Pay uses. */
export type CloverGooglePay = { updateGPayPaymentRequest(req: Record<string, unknown>): unknown };

/** A Clover element: `addEventListener` registers one listener per element type and event; a second throws. */
export type CloverWalletElement = {
  mount(selector: string): void;
  addEventListener(event: string, fn: (data: unknown) => void): void;
  removeEventListener?(event: string): void;
  unmount?(): void;
};
/** The page's one elements factory, shared with the card fields (never a second factory from Clover). */
export type CloverWalletElements = { create(type: string, options?: Record<string, unknown>): CloverWalletElement };

export type WindowLike = AppleWindowLike;

/** The page offers Google Pay at all: Clover, the switch on, and a merchant id (without one Clover's frame never gets its config and never draws the button). */
export function googlePayConfigured(config: { kind: string; googlePay?: boolean; merchantId?: string | null }): boolean {
  return config.kind === "clover" && config.googlePay === true && !!config.merchantId;
}

/** Google Pay is shown only where Apple Pay is not: a device that can pay with Apple Pay, on a page offering it, gets Apple Pay alone. */
export function googlePayAllowed(win: Partial<WindowLike> | undefined, applePayOffered: boolean): boolean {
  if (!win || win.isSecureContext === false) return false;
  return !(applePayOffered && applePayAvailable(win));
}

/** What Clover's frame gets as `paymentReqData`. A fresh object each time: the SDK edits it. */
export function googlePaymentRequest(amountCents: number) {
  return {
    total: { label: LABEL, amount: amountCents },
    currency: "USD",
    merchantName: LABEL,
    options: { totalPriceStatus: "FINAL", button: { buttonType: "pay", buttonColor: "default" } },
  };
}

/** Google's `PaymentsClient`, as far as we use it. */
type GoogleLike = { payments?: { api?: { PaymentsClient?: new (opts: { environment: string }) => { isReadyToPay(req: unknown): Promise<{ result?: boolean }> } } } };

/**
 * Whether Google would draw the button here: the same `isReadyToPay` question Clover's frame asks,
 * with the same card methods, asked from our page so we know when to make room for the button.
 * (The frame never says it rendered; it only says when it gives up.) Anything unexpected is no.
 */
export async function googlePayReady(google: GoogleLike | undefined, environment: "TEST" | "PRODUCTION"): Promise<boolean> {
  try {
    const Client = google?.payments?.api?.PaymentsClient;
    if (typeof Client !== "function") return false;
    const answer = await new Client({ environment }).isReadyToPay({
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [{ type: "CARD", parameters: { allowedAuthMethods: ["CRYPTOGRAM_3DS", "PAN_ONLY"], allowedCardNetworks: ["AMEX", "DISCOVER", "MASTERCARD", "VISA"] } }],
    });
    return answer?.result === true;
  } catch {
    return false;
  }
}

/** Clover's frame said it removed the Google Pay button (this device or merchant can't pay with it). */
export function isGooglePayRemoval(event: { origin?: string; data?: unknown }): boolean {
  if (!event.origin || !(CLOVER_FRAME_ORIGINS as readonly string[]).includes(event.origin)) return false;
  try {
    const m = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
    return m?.functionToInvoke === "removeGooglePayFromDom" && (m?.data?.iFrameTitle ?? GOOGLE_PAY_FRAME_TITLE) === GOOGLE_PAY_FRAME_TITLE;
  } catch {
    return false;
  }
}

/** The token and email from Clover's Google Pay `paymentMethod` answer, or null if it isn't one we can charge. */
export function readGooglePayment(data: unknown): { token: string; email: string | null } | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { token?: unknown; customer?: { email?: unknown } };
  if (typeof d.token !== "string" || !CARD_TOKEN.test(d.token)) return null;
  const raw = d.customer?.email;
  const email = typeof raw === "string" && /^[^\s@]+@[^\s@]+$/.test(raw) ? raw.slice(0, 200) : null;
  return { token: d.token, email };
}

export const MESSAGES = {
  noToken: "Google Pay didn't send a payment. Nothing was charged. Please try again, or pay by card.",
  invalid: "Please fill in the highlighted details first, then pay with Google Pay again. Nothing was charged.",
} as const;

export type GooglePayDeps = {
  win: Pick<WindowLike, "addEventListener" | "removeEventListener">;
  clover: CloverGooglePay;
  /** The page's one elements factory, shared with the card fields. */
  elements: CloverWalletElements;
  /** CSS selector of the div the button is mounted in. */
  mountSelector: string;
  amountCents: number;
  /** Submits the checkout form with the token; resolves with the server's answer. */
  submit(payment: { token: string; email: string | null }): Promise<WalletOutcome>;
  /** Shows an error on the page, in the form's own error box. */
  showError(message: string): void;
  /** Clover removed the button: hide its space and the "or pay by card" line. */
  onRemoved(): void;
};

/** Mounts Clover's Google Pay button and wires its events. Returns `setAmount` for later changes and `destroy`. */
export function mountGooglePay(deps: GooglePayDeps): { setAmount(cents: number): void; destroy(): void } {
  const { win, clover } = deps;
  let amount = deps.amountCents;
  let busy = false;
  let removed = false;

  // Listen before mounting: the frame may give up quickly.
  const onMessage = (event: Event) => {
    if (removed || !isGooglePayRemoval(event as MessageEvent)) return;
    removed = true;
    deps.onRemoved();
  };
  win.addEventListener("message", onMessage);

  const element = deps.elements.create(GOOGLE_PAY_ELEMENT, { paymentReqData: googlePaymentRequest(amount) });
  element.addEventListener("paymentMethod", (data) => {
    if (busy) return;
    const payment = readGooglePayment(data);
    if (!payment) {
      deps.showError(MESSAGES.noToken);
      return;
    }
    busy = true;
    deps
      .submit(payment)
      .then((outcome) => {
        if (outcome.kind === "invalid") deps.showError(MESSAGES.invalid);
        // A server error is already shown by the form; a payment goes on to the receipt.
      })
      .catch(() => deps.showError(MESSAGES.noToken))
      .finally(() => {
        busy = false;
      });
  });
  element.mount(deps.mountSelector);

  return {
    setAmount(cents: number) {
      if (!Number.isSafeInteger(cents) || cents <= 0 || cents === amount) return;
      amount = cents;
      clover.updateGPayPaymentRequest({ total: googlePaymentRequest(amount).total });
    },
    destroy() {
      win.removeEventListener("message", onMessage);
      // Clover keeps one listener per element type and event for the whole page, and throws on a
      // second: leave none behind, so a remount (React's development double effect) still works.
      try {
        element.removeEventListener?.("paymentMethod");
      } catch {
        // Already gone.
      }
      try {
        element.unmount?.();
      } catch {
        // The iframe may already be removed.
      }
    },
  };
}

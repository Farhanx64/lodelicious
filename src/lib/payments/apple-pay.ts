/**
 * Apple Pay through Clover's iframe SDK (D59). Framework free, so it is tested with fakes in Node;
 * `components/checkout/ApplePayButton.tsx` is the thin React wrapper around it.
 *
 * Clover's flow (docs.clover.com "Clover iframe features: Apple Pay", read 2026-11-11):
 *   1. `clover.createApplePaymentRequest({ amount, countryCode, currencyCode })`, amount in cents;
 *   2. `elements.create("PAYMENT_REQUEST_BUTTON_APPLE_PAY", { applePaymentRequest, sessionIdentifier })`
 *      mounted in a div; `sessionIdentifier` is the merchant's Clover id when the domain is registered
 *      in the Merchant Dashboard;
 *   3. the customer pays in Apple's sheet; Clover fires `paymentMethod` on `window` with
 *      `detail.tokenRecieved.id` (Clover's spelling), a single-use token;
 *   4. we charge that token exactly like a card token (same server action, same idempotency, holds and
 *      total check) and tell the sheet how it went with `clover.updateApplePaymentStatus("success" | "failed")`
 *      within Apple's 30 seconds;
 *   5. `clover.updateApplePaymentRequest({ amount, … })` changes the amount later.
 *
 * Nothing here has run against Clover or on an iPhone: see D59 for what must be checked live.
 */
import { CARD_TOKEN } from "./clover";

export const APPLE_PAY_ELEMENT = "PAYMENT_REQUEST_BUTTON_APPLE_PAY";
const REGION = { countryCode: "US", currencyCode: "USD" } as const;

/** The parts of a Clover instance Apple Pay uses. */
export type CloverApplePay = {
  createApplePaymentRequest(req: { amount: number; countryCode: string; currencyCode: string }): unknown;
  updateApplePaymentRequest(req: { amount: number; countryCode: string; currencyCode: string }): unknown;
  updateApplePaymentStatus(status: "success" | "failed"): unknown;
};

/** Clover's elements factory. Create it once per page: each `clover.elements()` adds another hidden relay frame, and two relays start two Apple Pay sessions per tap, which closes the sheet. */
export type CloverElements = { create(type: string, options?: Record<string, unknown>): { mount(selector: string): void } };

/** Apple's `ApplePaySession`, as far as we read it. */
type ApplePaySessionLike = { canMakePayments?: () => boolean };
export type WindowLike = {
  ApplePaySession?: ApplePaySessionLike;
  isSecureContext?: boolean;
  addEventListener(type: string, fn: (event: Event) => void): void;
  removeEventListener(type: string, fn: (event: Event) => void): void;
};

/**
 * Whether this device can pay with Apple Pay: Safari (or another browser with Apple Pay) on an
 * Apple device, over HTTPS. `canMakePayments()` is Apple's own check; it does not ask about a
 * specific card, because only Clover knows the merchant identifier, and Apple's guidance is to
 * show the button whenever it is true. Anything unexpected counts as no, so the card form is all
 * the customer sees.
 */
export function applePayAvailable(win: Partial<WindowLike> | undefined): boolean {
  try {
    if (!win || win.isSecureContext === false) return false;
    const session = win.ApplePaySession;
    return typeof session?.canMakePayments === "function" && session.canMakePayments() === true;
  } catch {
    return false;
  }
}

/** The page offers Apple Pay at all: Clover with the switch on and a merchant id (the button's session identifier). */
export function applePayConfigured(config: { kind: string; applePay?: boolean; merchantId?: string | null }): boolean {
  return config.kind === "clover" && config.applePay === true && !!config.merchantId;
}

/**
 * What Apple Pay should charge: a fixed amount, or one that follows a radio choice in the form
 * (checkout: the member's reward; reserve: deposit or pay in full). Every amount is worked out
 * on the server page the same way checkout charges it; the server still decides the real charge.
 */
export type ApplePayAmount = { cents: number; byChoice?: { field: string; cents: Record<string, number> } };

export function amountFor(spec: ApplePayAmount, chosen: string | null | undefined): number {
  const pick = spec.byChoice && chosen != null ? spec.byChoice.cents[chosen] : undefined;
  return Number.isSafeInteger(pick) && (pick as number) > 0 ? (pick as number) : spec.cents;
}

/** The token and email from Clover's `paymentMethod` event, or null if it isn't one we can charge. */
export function readPaymentMethod(detail: unknown): { token: string; email: string | null } | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as { tokenRecieved?: { id?: unknown }; tokenReceived?: { id?: unknown }; customerEmail?: unknown };
  const id = d.tokenRecieved?.id ?? d.tokenReceived?.id;
  if (typeof id !== "string" || !CARD_TOKEN.test(id)) return null;
  const email = typeof d.customerEmail === "string" && /^[^\s@]+@[^\s@]+$/.test(d.customerEmail) ? d.customerEmail.slice(0, 200) : null;
  return { token: id, email };
}

/** How the checkout form answered a wallet payment. */
export type WalletOutcome = { kind: "paid" } | { kind: "error"; message: string } | { kind: "invalid" };

export const MESSAGES = {
  noToken: "Apple Pay didn't send a payment. Nothing was charged. Please try again, or pay by card.",
  invalid: "Please fill in the highlighted details first, then pay with Apple Pay again. Nothing was charged.",
} as const;

export type ApplePayDeps = {
  win: WindowLike;
  clover: CloverApplePay;
  /** The page's one elements factory, shared with the card fields. */
  elements: CloverElements;
  /** CSS selector of the div the button is mounted in. */
  mountSelector: string;
  sessionIdentifier: string;
  amountCents: number;
  /** Submits the checkout form with the token; resolves with the server's answer. */
  submit(payment: { token: string; email: string | null }): Promise<WalletOutcome>;
  /** Shows an error on the page, in the form's own error box. */
  showError(message: string): void;
};

/**
 * Mounts the button and wires Clover's events. Returns `setAmount` for later changes and `destroy`
 * to remove the listeners.
 */
export function mountApplePay(deps: ApplePayDeps): { setAmount(cents: number): void; destroy(): void } {
  const { win, clover } = deps;
  let amount = deps.amountCents;
  let busy = false;
  // Clover's request goes to Apple untouched: an edited copy is not what Clover validates the session against.
  const request = clover.createApplePaymentRequest({ amount, ...REGION });
  deps.elements.create(APPLE_PAY_ELEMENT, { applePaymentRequest: request, sessionIdentifier: deps.sessionIdentifier }).mount(deps.mountSelector);

  const status = (s: "success" | "failed") => {
    try {
      clover.updateApplePaymentStatus(s);
    } catch {
      // The sheet may already be gone; the page shows the outcome either way.
    }
  };

  const onPaymentMethod = (event: Event) => {
    if (busy) return;
    const payment = readPaymentMethod((event as CustomEvent).detail);
    if (!payment) {
      status("failed");
      deps.showError(MESSAGES.noToken);
      return;
    }
    busy = true;
    deps
      .submit(payment)
      .then((outcome) => {
        if (outcome.kind === "paid") return status("success");
        status("failed");
        if (outcome.kind === "invalid") deps.showError(MESSAGES.invalid);
        // A server error is already shown by the form.
      })
      .catch(() => status("failed"))
      .finally(() => {
        busy = false;
      });
  };
  win.addEventListener("paymentMethod", onPaymentMethod);

  return {
    setAmount(cents: number) {
      if (!Number.isSafeInteger(cents) || cents <= 0 || cents === amount) return;
      amount = cents;
      clover.updateApplePaymentRequest({ amount, ...REGION });
    },
    destroy() {
      win.removeEventListener("paymentMethod", onPaymentMethod);
    },
  };
}

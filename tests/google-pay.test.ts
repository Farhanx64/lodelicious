import { readFileSync } from "node:fs";
import { createElement, type ComponentProps, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ActionForm } from "@/components/checkout/ActionForm";
import { CardFields } from "@/components/checkout/CardFields";
import { paidWithWallet } from "@/src/lib/checkout/form-state";
import type { WalletOutcome } from "@/src/lib/payments/apple-pay";
import { cloverConfigFrom, CloverPaymentProvider } from "@/src/lib/payments/clover";
import { FAKE_CLOVER_ENV, googlePayPaymentMethod } from "@/src/lib/payments/clover-fixtures";
import {
  GOOGLE_PAY_ELEMENT,
  googlePayAllowed,
  googlePayConfigured,
  googlePayReady,
  googlePaymentRequest,
  isGooglePayRemoval,
  MESSAGES,
  mountGooglePay,
  readGooglePayment,
  type CloverWalletElement,
} from "@/src/lib/payments/google-pay";

const MERCHANT = "ABCDEF123456";

describe("switching Google Pay on (D63)", () => {
  it("CLOVER_ECOMM_GOOGLE_PAY=on switches it on, and only with CLOVER_ECOMM_MERCHANT_ID; off by default", () => {
    expect(cloverConfigFrom(FAKE_CLOVER_ENV).googlePay).toBe(false);
    expect(cloverConfigFrom({ ...FAKE_CLOVER_ENV, CLOVER_ECOMM_MERCHANT_ID: MERCHANT }).googlePay).toBe(false);
    expect(cloverConfigFrom({ ...FAKE_CLOVER_ENV, CLOVER_ECOMM_GOOGLE_PAY: "on" }).googlePay).toBe(false);
    expect(cloverConfigFrom({ ...FAKE_CLOVER_ENV, CLOVER_ECOMM_GOOGLE_PAY: "on", CLOVER_ECOMM_MERCHANT_ID: MERCHANT }).googlePay).toBe(true);
    expect(cloverConfigFrom({ ...FAKE_CLOVER_ENV, CLOVER_ECOMM_GOOGLE_PAY: "off", CLOVER_ECOMM_MERCHANT_ID: MERCHANT }).googlePay).toBe(false);
  });

  it("is independent of the Apple Pay switch and reaches the browser config", () => {
    const config = cloverConfigFrom({ ...FAKE_CLOVER_ENV, CLOVER_ECOMM_GOOGLE_PAY: "on", CLOVER_ECOMM_MERCHANT_ID: MERCHANT });
    expect(config.applePay).toBe(false);
    expect(new CloverPaymentProvider(config).browser).toMatchObject({ kind: "clover", googlePay: true, applePay: false, merchantId: MERCHANT });
  });

  it("needs Clover, the switch and a merchant id on the page", () => {
    expect(googlePayConfigured({ kind: "clover", googlePay: true, merchantId: MERCHANT })).toBe(true);
    expect(googlePayConfigured({ kind: "clover", googlePay: false, merchantId: MERCHANT })).toBe(false);
    expect(googlePayConfigured({ kind: "clover", googlePay: true, merchantId: null })).toBe(false);
    expect(googlePayConfigured({ kind: "test" })).toBe(false);
  });
});

describe("only where Apple Pay is not shown", () => {
  const apple = (can: boolean) => ({ canMakePayments: () => can });
  it("is allowed without Apple Pay, or when the page doesn't offer Apple Pay", () => {
    expect(googlePayAllowed({ isSecureContext: true }, true)).toBe(true);
    expect(googlePayAllowed({ isSecureContext: true, ApplePaySession: apple(false) }, true)).toBe(true);
    expect(googlePayAllowed({ isSecureContext: true, ApplePaySession: apple(true) }, false)).toBe(true);
  });
  it("is not allowed where Apple Pay shows, off HTTPS, or without a window", () => {
    expect(googlePayAllowed({ isSecureContext: true, ApplePaySession: apple(true) }, true)).toBe(false);
    expect(googlePayAllowed({ isSecureContext: false }, false)).toBe(false);
    expect(googlePayAllowed(undefined, false)).toBe(false);
  });
});

describe("the page before Google has said yes", () => {
  const clover = { kind: "clover" as const, sdkUrl: "https://checkout.sandbox.dev.clover.com/sdk.js", publicKey: "pub_test_0000000000000000", merchantId: MERCHANT, googlePay: true };
  const render = (config: Parameters<typeof CardFields>[0]["config"]) =>
    renderToStaticMarkup(
      createElement(
        ActionForm as ComponentType<Omit<ComponentProps<typeof ActionForm>, "children">>,
        { action: async () => ({ error: null }), submitLabel: "Pay", pendingLabel: "…" },
        createElement(CardFields, { config, walletAmount: { cents: 2550 } }),
      ),
    );
  it("has no Google Pay button or divider in the server markup", () => {
    for (const html of [render(clover), render({ ...clover, applePay: true }), render({ ...clover, googlePay: false })]) {
      expect(html).not.toContain("google-pay-button");
      expect(html).not.toContain("or pay by card");
      expect(html).toContain("Card details");
    }
  });
});

describe("Clover's payment request", () => {
  it("carries the amount in cents, our name, a final total and Google's pay button", () => {
    expect(googlePaymentRequest(2550)).toEqual({
      total: { label: "Lodelicious", amount: 2550 },
      currency: "USD",
      merchantName: "Lodelicious",
      options: { totalPriceStatus: "FINAL", button: { buttonType: "pay", buttonColor: "default" } },
    });
    expect(googlePaymentRequest(1)).not.toBe(googlePaymentRequest(1)); // a fresh object: the SDK edits it
  });
});

describe("Google's isReadyToPay, asked from our page", () => {
  const google = (result: boolean | Error) => {
    const isReadyToPay = vi.fn(async () => {
      if (result instanceof Error) throw result;
      return { result };
    });
    const PaymentsClient = vi.fn(function (this: unknown) {
      return { isReadyToPay };
    });
    return { g: { payments: { api: { PaymentsClient } } }, PaymentsClient, isReadyToPay };
  };
  it("is yes only when Google says so, in the environment asked for", async () => {
    const yes = google(true);
    expect(await googlePayReady(yes.g as never, "TEST")).toBe(true);
    expect(yes.PaymentsClient).toHaveBeenCalledWith({ environment: "TEST" });
    expect(yes.isReadyToPay.mock.calls[0]).toEqual([
      expect.objectContaining({ apiVersion: 2, allowedPaymentMethods: [expect.objectContaining({ type: "CARD" })] }),
    ]);
    expect(await googlePayReady(google(false).g as never, "PRODUCTION")).toBe(false);
    expect(await googlePayReady(google(new Error("blocked")).g as never, "PRODUCTION")).toBe(false);
    expect(await googlePayReady(undefined, "PRODUCTION")).toBe(false);
    expect(await googlePayReady({}, "PRODUCTION")).toBe(false);
  });
});

describe("Clover removing the button", () => {
  const msg = (origin: string, data: unknown) => ({ origin, data: typeof data === "string" ? data : JSON.stringify(data) });
  it("is recognised only from Clover's frames, for the Google Pay frame", () => {
    expect(isGooglePayRemoval(msg("https://checkout.clover.com", { functionToInvoke: "removeGooglePayFromDom", data: { iFrameTitle: "PAYMENT REQUEST BUTTON" } }))).toBe(true);
    expect(isGooglePayRemoval(msg("https://checkout.sandbox.dev.clover.com", { functionToInvoke: "removeGooglePayFromDom", data: {} }))).toBe(true);
    expect(isGooglePayRemoval(msg("https://evil.example", { functionToInvoke: "removeGooglePayFromDom", data: {} }))).toBe(false);
    expect(isGooglePayRemoval(msg("https://checkout.clover.com", { functionToInvoke: "removeApplePayFromDom", data: { iFrameTitle: "PAYMENT REQUEST BUTTON APPLE PAY" } }))).toBe(false);
    expect(isGooglePayRemoval(msg("https://checkout.clover.com", { functionToInvoke: "removeGooglePayFromDom", data: { iFrameTitle: "PAYMENT REQUEST BUTTON SAMSUNG PAY" } }))).toBe(false);
    expect(isGooglePayRemoval(msg("https://checkout.clover.com", "not json"))).toBe(false);
  });
});

describe("Clover's Google Pay paymentMethod answer", () => {
  it("gives the token and the wallet's email", () => {
    expect(readGooglePayment(googlePayPaymentMethod())).toEqual({ token: "clv_1TSTgooglepaytoken", email: "ann@example.test" });
  });
  it("is refused without a Clover token, or when it is an error", () => {
    expect(readGooglePayment(googlePayPaymentMethod("tok_123"))).toBeNull();
    expect(readGooglePayment({ message: "Failed to fetch" })).toBeNull();
    expect(readGooglePayment({})).toBeNull();
    expect(readGooglePayment(undefined)).toBeNull();
  });
  it("drops an email that isn't one", () => {
    expect(readGooglePayment({ ...googlePayPaymentMethod(), customer: { email: "not an email" } })).toEqual({ token: "clv_1TSTgooglepaytoken", email: null });
  });
});

describe("a wallet-paid form", () => {
  it("answers with the receipt URL for Google Pay as for Apple Pay", () => {
    const form = (wallet?: string) => {
      const f = new FormData();
      if (wallet) f.set("wallet", wallet);
      return f;
    };
    expect(paidWithWallet(form("google_pay"))).toBe(true);
    expect(paidWithWallet(form("apple_pay"))).toBe(true);
    expect(paidWithWallet(form("paypal"))).toBe(false);
    expect(paidWithWallet(form())).toBe(false);
  });
});

function fakes(outcome: WalletOutcome | Error = { kind: "paid" }) {
  const win = new EventTarget();
  const listeners = new Map<string, (data: unknown) => void>();
  const element = {
    mount: vi.fn(),
    addEventListener: vi.fn((event: string, fn: (data: unknown) => void) => {
      if (listeners.has(event)) throw new Error(`${event} event is already registered`); // as Clover's SDK does
      listeners.set(event, fn);
    }),
    removeEventListener: vi.fn((event: string) => {
      if (!listeners.delete(event)) throw new Error("not registered");
    }),
    unmount: vi.fn(),
  } satisfies CloverWalletElement;
  const create = vi.fn(() => element);
  const clover = { updateGPayPaymentRequest: vi.fn() };
  const submit = vi.fn(async () => {
    if (outcome instanceof Error) throw outcome;
    return outcome;
  });
  const showError = vi.fn();
  const onRemoved = vi.fn();
  const deps = { win, clover, elements: { create }, mountSelector: "#google-pay-button", amountCents: 2550, submit, showError, onRemoved };
  const control = mountGooglePay(deps);
  const pay = async (data: unknown) => {
    listeners.get("paymentMethod")?.(data);
    await new Promise((r) => setTimeout(r, 0));
  };
  return { win, element, listeners, create, clover, submit, showError, onRemoved, control, pay, deps };
}

describe("paying with the button", () => {
  it("creates Clover's PAYMENT_REQUEST_BUTTON on the shared elements with paymentReqData, then mounts it", () => {
    const { create, element, listeners } = fakes();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(GOOGLE_PAY_ELEMENT, { paymentReqData: googlePaymentRequest(2550) });
    expect(GOOGLE_PAY_ELEMENT).toBe("PAYMENT_REQUEST_BUTTON");
    expect(element.mount).toHaveBeenCalledWith("#google-pay-button");
    expect([...listeners.keys()]).toEqual(["paymentMethod"]);
  });

  it("submits the token with the wallet's email; nothing more to tell Google", async () => {
    const { submit, showError, pay } = fakes({ kind: "paid" });
    await pay(googlePayPaymentMethod());
    expect(submit).toHaveBeenCalledWith({ token: "clv_1TSTgooglepaytoken", email: "ann@example.test" });
    expect(showError).not.toHaveBeenCalled();
  });

  it("leaves a server error to the form, and says what to fill in when the form isn't complete", async () => {
    const server = fakes({ kind: "error", message: "Your card was declined." });
    await server.pay(googlePayPaymentMethod());
    expect(server.showError).not.toHaveBeenCalled();
    const invalid = fakes({ kind: "invalid" });
    await invalid.pay(googlePayPaymentMethod());
    expect(invalid.showError).toHaveBeenCalledWith(MESSAGES.invalid);
  });

  it("never submits without a Clover token, and says nothing was charged", async () => {
    const { submit, showError, pay } = fakes();
    await pay({ message: "tokenization failed" });
    expect(submit).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith(MESSAGES.noToken);
  });

  it("ignores a second token while the first is being paid", async () => {
    let finish: (o: WalletOutcome) => void = () => {};
    const f = fakes();
    f.submit.mockImplementationOnce(() => new Promise<WalletOutcome>((r) => (finish = r)));
    f.listeners.get("paymentMethod")!(googlePayPaymentMethod());
    f.listeners.get("paymentMethod")!(googlePayPaymentMethod());
    expect(f.submit).toHaveBeenCalledTimes(1);
    finish({ kind: "paid" });
  });

  it("hides itself when Clover's frame removes the button", () => {
    const { win, onRemoved } = fakes();
    const remove = (origin: string) =>
      win.dispatchEvent(Object.assign(new Event("message"), { origin, data: JSON.stringify({ functionToInvoke: "removeGooglePayFromDom", data: { iFrameTitle: "PAYMENT REQUEST BUTTON" } }) }));
    remove("https://evil.example");
    expect(onRemoved).not.toHaveBeenCalled();
    remove("https://checkout.clover.com");
    remove("https://checkout.clover.com");
    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  it("updates the amount only when it changes, through updateGPayPaymentRequest", () => {
    const { clover, control } = fakes();
    control.setAmount(2550);
    control.setAmount(0);
    control.setAmount(12.5);
    expect(clover.updateGPayPaymentRequest).not.toHaveBeenCalled();
    control.setAmount(3445);
    expect(clover.updateGPayPaymentRequest).toHaveBeenCalledWith({ total: { label: "Lodelicious", amount: 3445 } });
  });

  it("removes its Clover listeners and the frame when destroyed, so it can mount again", async () => {
    const f = fakes();
    f.control.destroy();
    expect(f.listeners.size).toBe(0);
    expect(f.element.unmount).toHaveBeenCalled();
    await f.pay(googlePayPaymentMethod());
    expect(f.submit).not.toHaveBeenCalled();
    // Clover throws on a second registration of the same event: a clean destroy lets a remount work.
    expect(() => mountGooglePay(f.deps)).not.toThrow();
  });
});

describe("one Clover elements factory per page", () => {
  it("the card form passes its own elements to Google Pay too; nothing calls clover.elements() again", () => {
    expect(readFileSync("components/checkout/CardFields.tsx", "utf8").match(/\.elements\(\)/g)).toHaveLength(1);
    for (const file of ["components/checkout/GooglePayButton.tsx", "src/lib/payments/google-pay.ts"]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/\.elements\(\)/);
    }
    expect(readFileSync("src/lib/payments/google-pay.ts", "utf8")).toContain("deps.elements.create(GOOGLE_PAY_ELEMENT");
    expect(readFileSync("components/checkout/CardFields.tsx", "utf8")).toMatch(/<GooglePayButton[\s\S]*?elements=\{instance\.elements\}/);
  });
});

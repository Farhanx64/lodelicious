/**
 * Apple Pay through Clover's iframe (D59): only offered where the device has Apple Pay and the
 * store switched it on; the amount follows the order; Clover's event token goes to the same form
 * submit as a card token; and the domain verification file is served where Apple looks for it.
 * No network, no browser: Clover and `window` are fakes.
 */
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import { createElement, type ComponentProps, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ActionForm } from "@/components/checkout/ActionForm";
import { CardFields } from "@/components/checkout/CardFields";
import nextConfig from "@/next.config";
import {
  amountFor,
  APPLE_PAY_ELEMENT,
  applePayAvailable,
  applePayConfigured,
  MESSAGES,
  mountApplePay,
  readPaymentMethod,
  type CloverApplePay,
  type WalletOutcome,
} from "@/src/lib/payments/apple-pay";
import { cloverConfigFrom } from "@/src/lib/payments/clover";
import { applePayPaymentMethod, FAKE_CLOVER_ENV } from "@/src/lib/payments/clover-fixtures";
import { APPLE_PAY_DOMAIN_FILE } from "@/src/lib/security";

const root = path.resolve(__dirname, "..");

describe("is Apple Pay offered on this device?", () => {
  const session = (can: boolean | (() => boolean)) => ({ canMakePayments: typeof can === "function" ? can : () => can });

  it("only where Apple's own check says yes, over HTTPS", () => {
    expect(applePayAvailable({ isSecureContext: true, ApplePaySession: session(true) })).toBe(true);
    expect(applePayAvailable({ isSecureContext: true, ApplePaySession: session(false) })).toBe(false);
    expect(applePayAvailable({ isSecureContext: false, ApplePaySession: session(true) })).toBe(false);
  });

  it("not in Chrome, Firefox or anything without ApplePaySession, nor when the check throws", () => {
    expect(applePayAvailable({ isSecureContext: true })).toBe(false);
    expect(applePayAvailable(undefined)).toBe(false);
    expect(applePayAvailable({ isSecureContext: true, ApplePaySession: {} })).toBe(false);
    expect(
      applePayAvailable({
        isSecureContext: true,
        ApplePaySession: session(() => {
          throw new Error("InvalidAccessError");
        }),
      }),
    ).toBe(false);
  });

  it("only with Clover, the store switch on, and a merchant id", () => {
    expect(applePayConfigured({ kind: "clover", applePay: true, merchantId: "ABCDEF123456" })).toBe(true);
    expect(applePayConfigured({ kind: "clover", applePay: false, merchantId: "ABCDEF123456" })).toBe(false);
    expect(applePayConfigured({ kind: "clover", applePay: true, merchantId: null })).toBe(false);
    expect(applePayConfigured({ kind: "test" })).toBe(false);
  });

  it("CLOVER_ECOMM_APPLE_PAY=on switches it on, and only with CLOVER_ECOMM_MERCHANT_ID", () => {
    expect(cloverConfigFrom(FAKE_CLOVER_ENV).applePay).toBe(false);
    expect(cloverConfigFrom({ ...FAKE_CLOVER_ENV, CLOVER_ECOMM_APPLE_PAY: "on" }).applePay).toBe(false);
    expect(cloverConfigFrom({ ...FAKE_CLOVER_ENV, CLOVER_ECOMM_APPLE_PAY: "on", CLOVER_ECOMM_MERCHANT_ID: "ABCDEF123456" }).applePay).toBe(true);
    expect(cloverConfigFrom({ ...FAKE_CLOVER_ENV, CLOVER_ECOMM_APPLE_PAY: "off", CLOVER_ECOMM_MERCHANT_ID: "ABCDEF123456" }).applePay).toBe(false);
  });
});

describe("the page without Apple Pay is unchanged", () => {
  const clover = {
    kind: "clover" as const,
    sdkUrl: "https://checkout.sandbox.dev.clover.com/sdk.js",
    publicKey: "pub_test_0000000000000000",
    merchantId: "ABCDEF123456",
    applePay: true,
  };
  const render = (config: Parameters<typeof CardFields>[0]["config"]) =>
    renderToStaticMarkup(
      createElement(
        ActionForm as ComponentType<Omit<ComponentProps<typeof ActionForm>, "children">>,
        { action: async () => ({ error: null }), submitLabel: "Pay", pendingLabel: "…" },
        createElement(CardFields, { config, walletAmount: { cents: 2550 } }),
      ),
    );

  it("renders no Apple Pay button or divider before the browser has said it has Apple Pay", () => {
    for (const html of [render(clover), render({ ...clover, applePay: false }), render({ kind: "test" })]) {
      expect(html).not.toContain("apple-pay-button");
      expect(html).not.toContain("or pay by card");
      expect(html).toContain("Card details");
    }
  });
});

describe("the amount on Apple's sheet", () => {
  it("is the order total, or what the radio choice charges", () => {
    const spec = { cents: 2550, byChoice: { field: "reward", cents: { none: 2550, five: 2018 } } };
    expect(amountFor(spec, null)).toBe(2550);
    expect(amountFor(spec, "none")).toBe(2550);
    expect(amountFor(spec, "five")).toBe(2018);
    expect(amountFor(spec, "unknown-option")).toBe(2550);
    expect(amountFor({ cents: 1958 }, "five")).toBe(1958);
  });

});

describe("Clover's paymentMethod event", () => {
  it("gives the token and the wallet's email", () => {
    expect(readPaymentMethod(applePayPaymentMethod())).toEqual({ token: "clv_1TSTapplepaytoken", email: "ann@example.test" });
  });

  it("is refused without a Clover token", () => {
    expect(readPaymentMethod(applePayPaymentMethod("tok_123"))).toBeNull();
    expect(readPaymentMethod({ status: "failed" })).toBeNull();
    expect(readPaymentMethod(undefined)).toBeNull();
  });
});

function fakes(outcome: WalletOutcome | Error = { kind: "paid" }) {
  const win = new EventTarget();
  const mount = vi.fn();
  const create = vi.fn(() => ({ mount }));
  const clover = {
    createApplePaymentRequest: vi.fn((req: { amount: number }) => ({
      countryCode: "US",
      currencyCode: "USD",
      total: { label: "Amount to be charged", type: "final", amount: (req.amount / 100).toFixed(2) },
    })),
    updateApplePaymentRequest: vi.fn(),
    updateApplePaymentStatus: vi.fn(),
  } satisfies CloverApplePay;
  const submit = vi.fn(async () => {
    if (outcome instanceof Error) throw outcome;
    return outcome;
  });
  const showError = vi.fn();
  const control = mountApplePay({ win, clover, elements: { create }, mountSelector: "#apple-pay-button", sessionIdentifier: "ABCDEF123456", amountCents: 2550, submit, showError });
  const pay = async (detail: unknown) => {
    win.dispatchEvent(new CustomEvent("paymentMethod", { detail }));
    await new Promise((r) => setTimeout(r, 0));
  };
  return { win, clover, create, mount, submit, showError, control, pay };
}

describe("paying with the button", () => {
  it("mounts Clover's Apple Pay element with the total, our label and the merchant id", () => {
    const { clover, create, mount } = fakes();
    expect(clover.createApplePaymentRequest).toHaveBeenCalledWith({ amount: 2550, countryCode: "US", currencyCode: "USD" });
    expect(create).toHaveBeenCalledWith(APPLE_PAY_ELEMENT, {
      applePaymentRequest: { countryCode: "US", currencyCode: "USD", total: { label: "Amount to be charged", type: "final", amount: "25.50" } },
      sessionIdentifier: "ABCDEF123456",
    });
    expect(mount).toHaveBeenCalledWith("#apple-pay-button");
  });

  it("submits the token, and tells the sheet it worked once the server has paid", async () => {
    const { submit, clover, pay } = fakes({ kind: "paid" });
    await pay(applePayPaymentMethod());
    expect(submit).toHaveBeenCalledWith({ token: "clv_1TSTapplepaytoken", email: "ann@example.test" });
    expect(clover.updateApplePaymentStatus).toHaveBeenCalledWith("success");
  });

  it("tells the sheet it failed on a server error (the form shows the server's message)", async () => {
    const { clover, showError, pay } = fakes({ kind: "error", message: "Your card was declined." });
    await pay(applePayPaymentMethod());
    expect(clover.updateApplePaymentStatus).toHaveBeenCalledWith("failed");
    expect(showError).not.toHaveBeenCalled();
  });

  it("fails the sheet and says what to fill in when the form isn't complete", async () => {
    const { clover, showError, pay } = fakes({ kind: "invalid" });
    await pay(applePayPaymentMethod());
    expect(clover.updateApplePaymentStatus).toHaveBeenCalledWith("failed");
    expect(showError).toHaveBeenCalledWith(MESSAGES.invalid);
  });

  it("fails the sheet if the submit itself breaks", async () => {
    const { clover, pay } = fakes(new Error("network"));
    await pay(applePayPaymentMethod());
    expect(clover.updateApplePaymentStatus).toHaveBeenCalledWith("failed");
  });

  it("never submits without a Clover token", async () => {
    const { submit, clover, showError, pay } = fakes();
    await pay({ status: "failed" });
    expect(submit).not.toHaveBeenCalled();
    expect(clover.updateApplePaymentStatus).toHaveBeenCalledWith("failed");
    expect(showError).toHaveBeenCalledWith(MESSAGES.noToken);
  });

  it("updates the amount only when it changes, and stops listening when removed", async () => {
    const { clover, control, submit, pay } = fakes();
    control.setAmount(2550);
    control.setAmount(0);
    expect(clover.updateApplePaymentRequest).not.toHaveBeenCalled();
    control.setAmount(3445);
    expect(clover.updateApplePaymentRequest).toHaveBeenCalledWith({ amount: 3445, countryCode: "US", currencyCode: "USD" });
    control.destroy();
    await pay(applePayPaymentMethod());
    expect(submit).not.toHaveBeenCalled();
  });
});

describe("Apple Pay domain verification file", () => {
  const file = path.join(root, "public", APPLE_PAY_DOMAIN_FILE);

  it("is in public/ at Apple's exact path, with no extension", () => {
    expect(APPLE_PAY_DOMAIN_FILE).toBe("/.well-known/apple-developer-merchantid-domain-association");
    expect(statSync(file).isFile()).toBe(true);
    const text = readFileSync(file, "utf8").trim();
    expect(text).toMatch(/^[0-9A-F]{1000,}$/); // Apple's hex-encoded association
  });

  it("is served as text by next start and by the Workers static assets", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const rules = (await nextConfig.headers!()) as { source: string; headers: { key: string; value: string }[] }[];
    vi.unstubAllEnvs();
    expect(rules.find((r) => r.source === APPLE_PAY_DOMAIN_FILE)?.headers).toEqual([{ key: "Content-Type", value: "text/plain; charset=utf-8" }]);
    const headers = readFileSync(path.join(root, "public", "_headers"), "utf8");
    expect(headers).toMatch(new RegExp(`^${APPLE_PAY_DOMAIN_FILE.replace(/[.]/g, "\\.")}\\n\\s+Content-Type: text/plain`, "m"));
  });
});

describe("one Clover elements factory per page", () => {
  it("the card form passes its own elements to Apple Pay instead of creating a second relay", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("components/checkout/CardFields.tsx", "utf8");
    expect(src.match(/\.elements\(\)/g)).toHaveLength(1);
    expect(fs.readFileSync("src/lib/payments/apple-pay.ts", "utf8")).toContain("deps.elements.create(APPLE_PAY_ELEMENT");
  });
});

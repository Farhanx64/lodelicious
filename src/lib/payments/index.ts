/**
 * Payment providers (D35, D54).
 *
 * - Clover (`CLOVER_ECOMM_PUBLIC_KEY`, `CLOVER_ECOMM_PRIVATE_TOKEN`, `CLOVER_ECOMM_ENVIRONMENT`): the
 *   embedded card form and Clover's ecommerce API. On the live store only `production` is accepted;
 *   sandbox keys are refused there, so a test card can never place a real order.
 * - The test provider: only when APP_ENV is local, staging or test and Clover is not configured. "Place
 *   test order", no money moves, orders are flagged as test.
 * - Otherwise none: checkout says "call to order".
 *
 * "Production" is anything but an explicit APP_ENV of local, staging or test (D41).
 */
import crypto from "node:crypto";

import { isPreviewEnv } from "../app-env";
import { CloverConfigError, CloverPaymentProvider, cloverConfigFrom, cloverPaymentsRequested } from "./clover";
import type { PaymentProvider } from "./types";

export type { BrowserPaymentConfig, ChargeInput, ChargeOrderDetails, ChargeResult, LookupResult, PaymentProvider } from "./types";

/** Approves every charge without moving money. Same key → same reference, like a real gateway. */
export const testProvider: PaymentProvider = {
  id: "test",
  test: true,
  needsCardToken: false,
  browser: { kind: "test" },
  async charge({ amountCents, idempotencyKey }) {
    if (!Number.isSafeInteger(amountCents) || amountCents < 0) return { status: "failed", reference: "", message: "Invalid amount" };
    return { status: "paid", reference: `test_${crypto.createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 20)}` };
  },
};

export type PaymentSetup = { provider: PaymentProvider | null; problem: string | null };

/** The provider for this process, and, when Clover was asked for but can't be used, why (for the system check). */
export function resolvePayments(env: Record<string, string | undefined> = process.env): PaymentSetup {
  if (cloverPaymentsRequested(env)) {
    try {
      const config = cloverConfigFrom(env);
      if (!isPreviewEnv(env) && config.environment !== "production") {
        return { provider: null, problem: "Clover sandbox keys are refused on the live store (set CLOVER_ECOMM_ENVIRONMENT=production with production keys)" };
      }
      return { provider: new CloverPaymentProvider(config), problem: null };
    } catch (e) {
      if (e instanceof CloverConfigError) return { provider: null, problem: e.message };
      throw e;
    }
  }
  return { provider: isPreviewEnv(env) ? testProvider : null, problem: null };
}

export function getPaymentProvider(env: Record<string, string | undefined> = process.env): PaymentProvider | null {
  return resolvePayments(env).provider;
}

export type OrderingState = { open: true } | { open: false; reason: "no_payments" | "tax_unapproved" };

/** Whether customers may submit: a provider must exist, and live orders also need approved tax. */
export function orderingState(provider: PaymentProvider | null, taxApproved: boolean): OrderingState {
  if (!provider) return { open: false, reason: "no_payments" };
  if (!provider.test && !taxApproved) return { open: false, reason: "tax_unapproved" };
  return { open: true };
}

/** One line for /ops/system-check (D54). Says which provider is active; never prints a key. */
export function paymentsCheck(env: Record<string, string | undefined> = process.env): { check: string; expected: string; actual: string; ok: boolean } {
  const { provider, problem } = resolvePayments(env);
  const expected = "Clover production on the live site; Clover sandbox or the test payment elsewhere";
  if (problem) return { check: "Payments", expected, actual: `not taking payments: ${problem}`, ok: false };
  if (!provider) return { check: "Payments", expected, actual: "none: checkout says \"call to order\"", ok: !isPreviewEnv(env) };
  const actual = provider.id === "clover" ? `Clover ${provider.test ? "sandbox (no real money)" : "production"}` : "test payment (no money moves)";
  return { check: "Payments", expected, actual, ok: isPreviewEnv(env) || (provider.id === "clover" && !provider.test) };
}

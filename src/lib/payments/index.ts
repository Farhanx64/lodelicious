/**
 * Payment providers (D35). Only a test provider exists until Clover is connected in milestone 6
 * with Lody's approval; it is unavailable in production, so production cannot take orders yet.
 */
import crypto from "node:crypto";

import type { Cents } from "../money";

export type ChargeInput = { reference: string; amountCents: Cents; idempotencyKey: string };
export type ChargeResult = { status: "paid" | "failed"; reference: string; message?: string };

export type PaymentProvider = { id: string; test: boolean; charge(input: ChargeInput): Promise<ChargeResult> };

/** Approves every charge without moving money. Same key → same reference, like a real gateway. */
export const testProvider: PaymentProvider = {
  id: "test",
  test: true,
  async charge({ amountCents, idempotencyKey }) {
    if (!Number.isSafeInteger(amountCents) || amountCents < 0) return { status: "failed", reference: "", message: "Invalid amount" };
    return { status: "paid", reference: `test_${crypto.createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 20)}` };
  },
};

export function getPaymentProvider(env: Record<string, string | undefined> = process.env): PaymentProvider | null {
  return env.APP_ENV === "production" ? null : testProvider;
}

export type OrderingState = { open: true } | { open: false; reason: "no_payments" | "tax_unapproved" };

/** Whether customers may submit: a provider must exist, and live orders also need approved tax. */
export function orderingState(provider: PaymentProvider | null, taxApproved: boolean): OrderingState {
  if (!provider) return { open: false, reason: "no_payments" };
  if (!provider.test && !taxApproved) return { open: false, reason: "tax_unapproved" };
  return { open: true };
}

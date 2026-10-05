/**
 * Basket reservation deposits (D36). Lody sets a percentage or a flat amount in /admin; the
 * deposit is taken on the basket total (tax included), never exceeds it, and rounds half-up.
 */
import { assertCents, type Cents } from "../money";

export type DepositRule = { type: "percent" | "flat"; percentBasisPoints: number; flatCents: Cents };

export function depositFor(totalCents: Cents, rule: DepositRule): Cents {
  assertCents(totalCents);
  if (totalCents <= 0) return 0;
  const raw = rule.type === "flat" ? assertCents(rule.flatCents) : Math.floor((totalCents * rule.percentBasisPoints + 5000) / 10000);
  return Math.min(totalCents, Math.max(0, raw));
}

export type PaymentPlan = { chargeNowCents: Cents; balanceDueCents: Cents; paidInFull: boolean };

export function paymentPlan(totalCents: Cents, rule: DepositRule, payInFull: boolean): PaymentPlan {
  const deposit = depositFor(totalCents, rule);
  const now = payInFull ? totalCents : deposit;
  return { chargeNowCents: now, balanceDueCents: totalCents - now, paidInFull: now === totalCents };
}

/**
 * Member rewards (D45): the program's rules as pure functions. Framework-free, so the settings
 * hook, checkout, the account pages and the tests all share one definition.
 *
 * Nothing here is a business fact. How many points a dollar earns, what a reward is worth and the
 * terms come from Settings → Rewards, which start empty. The program reaches customers only when
 * staff switch it on, at least one reward is set, and Lody approves the terms; staging shows it
 * unapproved, marked as a draft (the same rule as policies, D39).
 *
 * Points are earned on what the customer paid before tax, after any reward discount, rounded down.
 * A reward is a fixed amount off a shop order's subtotal, taken before tax, and never more than the
 * subtotal.
 */
import { isPreviewEnv, type EnvLike } from "../app-env";
import { assertCents, type Cents } from "../money";
import { computeTax, type TaxClass } from "../checkout/tax";

export type RewardOption = { id: string; pointsRequired: number; discountCents: Cents };

export type RewardsConfig = {
  enabled: boolean;
  approved: boolean;
  programName: string;
  /** Points per whole dollar spent before tax. Null until staff set it. */
  pointsPerDollar: number | null;
  /** Points a new member starts with. */
  welcomePoints: number;
  options: RewardOption[];
  terms: string;
};

export type RewardsState = {
  /** Customers can join, sign in, earn and redeem. */
  active: boolean;
  /** Active on staging only because the terms aren't approved yet: show a draft notice. */
  draft: boolean;
  /** Why the program is off, for staff (Settings and the system check). Null when active. */
  reason: string | null;
};

export const DEFAULT_PROGRAM_NAME = "Rewards";
/** A guard against a typo such as 1000 points per dollar; staff can still choose anything up to it. */
export const MAX_POINTS_PER_DOLLAR = 100;
export const MAX_POINTS = 1_000_000;

const wholeNumber = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);

/** What is wrong with these settings before they can be switched on, or null. */
export function configProblem(c: Pick<RewardsConfig, "pointsPerDollar" | "welcomePoints" | "options">): string | null {
  if (!wholeNumber(c.pointsPerDollar) || c.pointsPerDollar < 1 || c.pointsPerDollar > MAX_POINTS_PER_DOLLAR) {
    return `Set how many points a dollar earns (a whole number from 1 to ${MAX_POINTS_PER_DOLLAR}).`;
  }
  if (!wholeNumber(c.welcomePoints) || c.welcomePoints < 0 || c.welcomePoints > MAX_POINTS) return "Welcome points must be a whole number, 0 or more.";
  if (c.options.length === 0) return "Add at least one reward.";
  const seen = new Set<number>();
  for (const o of c.options) {
    if (!wholeNumber(o.pointsRequired) || o.pointsRequired < 1 || o.pointsRequired > MAX_POINTS) return "Each reward needs a whole number of points, 1 or more.";
    if (!wholeNumber(o.discountCents) || o.discountCents < 1) return "Each reward needs an amount off of at least 1 cent.";
    if (seen.has(o.pointsRequired)) return "Two rewards can't cost the same number of points.";
    seen.add(o.pointsRequired);
  }
  return null;
}

export function rewardsState(c: RewardsConfig, env: EnvLike = process.env): RewardsState {
  if (!c.enabled) return { active: false, draft: false, reason: "The program is switched off." };
  const problem = configProblem(c);
  if (problem) return { active: false, draft: false, reason: problem };
  if (c.approved) return { active: true, draft: false, reason: null };
  if (isPreviewEnv(env)) return { active: true, draft: true, reason: null };
  return { active: false, draft: false, reason: "The owner hasn't approved the terms yet." };
}

/** Points for an amount spent before tax: whole dollars' worth, rounded down. */
export function pointsFor(eligibleCents: Cents, pointsPerDollar: number | null): number {
  assertCents(eligibleCents);
  if (!wholeNumber(pointsPerDollar) || pointsPerDollar < 1 || eligibleCents <= 0) return 0;
  return Math.floor((eligibleCents * pointsPerDollar) / 100);
}

/** Rewards from cheapest to dearest. */
export function sortedOptions(options: readonly RewardOption[]): RewardOption[] {
  return [...options].sort((a, b) => a.pointsRequired - b.pointsRequired);
}

/** Rewards this balance can pay for on this subtotal: enough points, and never more than the subtotal. */
export function affordableOptions(options: readonly RewardOption[], balance: number, subtotalCents: Cents): RewardOption[] {
  return sortedOptions(options).filter((o) => o.pointsRequired <= balance && o.discountCents <= subtotalCents);
}

/** The cheapest reward still out of reach, and how many points it needs: for "N points to your next reward". */
export function nextReward(options: readonly RewardOption[], balance: number): { option: RewardOption; pointsToGo: number } | null {
  const option = sortedOptions(options).find((o) => o.pointsRequired > balance);
  return option ? { option, pointsToGo: option.pointsRequired - balance } : null;
}

/**
 * Splits a discount over lines in proportion to their amounts, in whole cents: each line gets the
 * rounded-down share, and the cents left over go to the lines with the largest remainders (ties to
 * the earlier line). The shares add up to the discount exactly, and no line goes below zero.
 */
export function allocateDiscount(amounts: readonly Cents[], discountCents: Cents): Cents[] {
  amounts.forEach(assertCents);
  assertCents(discountCents);
  const total = amounts.reduce((s, a) => s + Math.max(0, a), 0);
  const discount = Math.min(Math.max(0, discountCents), total);
  if (discount === 0 || total === 0) return amounts.map(() => 0);
  const shares = amounts.map((a) => Math.floor((Math.max(0, a) * discount) / total));
  let left = discount - shares.reduce((s, x) => s + x, 0);
  const byRemainder = amounts
    .map((a, i) => ({ i, rem: (Math.max(0, a) * discount) % total }))
    .sort((x, y) => y.rem - x.rem || x.i - y.i);
  for (const { i } of byRemainder) {
    if (left === 0) break;
    if (shares[i] < Math.max(0, amounts[i])) {
      shares[i] += 1;
      left -= 1;
    }
  }
  return shares;
}

export type DiscountedLine = { amountCents: Cents; taxClass: TaxClass | null };

export type DiscountedTotals = {
  discountCents: Cents;
  perLineDiscount: Cents[];
  perLineTax: Cents[];
  subtotalCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  taxApproved: boolean;
};

/**
 * Totals with a reward taken off before tax: each line's share of the discount comes off its taxable
 * amount, then tax is worked out per line as usual (D34). Whether a store reward lowers the taxable
 * amount is a tax question Lody's accountant should confirm (D45).
 */
export function totalsWithDiscount(lines: readonly DiscountedLine[], discountCents: Cents): DiscountedTotals {
  const amounts = lines.map((l) => l.amountCents);
  const perLineDiscount = allocateDiscount(amounts, discountCents);
  const tax = computeTax(lines.map((l, i) => ({ amountCents: l.amountCents - perLineDiscount[i], taxClass: l.taxClass })));
  const subtotalCents = amounts.reduce((s, a) => s + a, 0);
  const discount = perLineDiscount.reduce((s, a) => s + a, 0);
  return {
    discountCents: discount,
    perLineDiscount,
    perLineTax: tax.perLine,
    subtotalCents,
    taxCents: tax.taxCents,
    totalCents: subtotalCents - discount + tax.taxCents,
    taxApproved: tax.approved,
  };
}

export const formatPoints = (n: number): string => `${n.toLocaleString("en-US")} ${Math.abs(n) === 1 ? "point" : "points"}`;

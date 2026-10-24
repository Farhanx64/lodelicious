/**
 * Chocolate-fountain rental terms and estimate (D37). Pure and client-safe: the /events
 * calculator and the server use this same function, but the server always recomputes the
 * estimate it stores from the stored settings and never trusts a number from the browser.
 *
 * PRD: $250 for two hours including setup and service, plus $8.50 per person ($5 chocolate +
 * $3.50 fruit); a 25% deposit is requested after staff confirm. The estimate is
 * base + perGuest x guests. Tax, extra approved charges and the deposit basis are NOT part of it.
 */
import { assertCents, multiplyCents, sumCents, type Cents } from "../money";

export const MIN_GUESTS = 1;
export const MAX_GUESTS = 1000;

export type FountainTerms = {
  baseCents: Cents;
  includedHours: number;
  perGuestCents: Cents;
  /** Display breakdown of the per-guest price; null when not set. */
  chocolatePerGuestCents: Cents | null;
  fruitPerGuestCents: Cents | null;
  /** Share of the confirmed price requested as a deposit, in basis points (2500 = 25%). */
  depositPercentBasisPoints: number;
};

/** The confirmed offer (PRD "Chocolate fountain rentals"). */
export const DEFAULT_FOUNTAIN_TERMS: FountainTerms = {
  baseCents: 25000,
  includedHours: 2,
  perGuestCents: 850,
  chocolatePerGuestCents: 500,
  fruitPerGuestCents: 350,
  depositPercentBasisPoints: 2500,
};

/** A guest count: a whole number from 1 to 1000, as a number or a string of digits. Otherwise null. */
export function parseGuests(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && /^\d{1,5}$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  return Number.isSafeInteger(n) && n >= MIN_GUESTS && n <= MAX_GUESTS ? n : null;
}

export type FountainEstimate = {
  guests: number;
  baseCents: Cents;
  perGuestCents: Cents;
  /** perGuestCents x guests */
  guestsCents: Cents;
  /** baseCents + guestsCents, before tax and any other approved charges. */
  totalCents: Cents;
};

/** Estimate = base + perGuest x guests, in integer cents. Null when the guest count is not valid. */
export function fountainEstimate(guests: unknown, terms: Pick<FountainTerms, "baseCents" | "perGuestCents">): FountainEstimate | null {
  const count = parseGuests(guests);
  if (count === null) return null;
  const guestsCents = multiplyCents(assertCents(terms.perGuestCents), count);
  return { guests: count, baseCents: terms.baseCents, perGuestCents: terms.perGuestCents, guestsCents, totalCents: sumCents([terms.baseCents, guestsCents]) };
}

/** 2500 -> "25", 1250 -> "12.5". Integer maths only. */
export function formatBasisPoints(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = String(basisPoints % 100).padStart(2, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

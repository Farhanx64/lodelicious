/**
 * Sales tax from owner-set tax classes (D34). Rates are basis points (625 = 6.25%), tax is
 * rounded half-up per line, and nothing counts as approved until every class used is approved.
 */
import { assertCents, sumCents, type Cents } from "../money";

export type TaxClass = { id: string; name: string; rateBasisPoints: number; approved: boolean };

export type TaxableLine = { amountCents: Cents; taxClass: TaxClass | null };

export type TaxResult = {
  taxCents: Cents;
  /** False if any line has no class or an unapproved one: show "estimated" and block live orders. */
  approved: boolean;
  perLine: Cents[];
};

export function taxFor(amountCents: Cents, taxClass: TaxClass | null): Cents {
  assertCents(amountCents);
  if (!taxClass || amountCents <= 0) return 0;
  return Math.floor((amountCents * taxClass.rateBasisPoints + 5000) / 10000);
}

export function computeTax(lines: readonly TaxableLine[]): TaxResult {
  const perLine = lines.map((l) => taxFor(l.amountCents, l.taxClass));
  return {
    taxCents: sumCents(perLine),
    approved: lines.every((l) => l.taxClass?.approved === true),
    perLine,
  };
}

/** A product's own class, else the default class. */
export function resolveTaxClass(classId: string | null | undefined, classes: readonly TaxClass[], defaultId: string | null): TaxClass | null {
  return classes.find((c) => c.id === classId) ?? classes.find((c) => c.id === defaultId) ?? null;
}

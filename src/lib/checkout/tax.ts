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

/** 625 basis points → "6.25%"; 700 → "7%". */
export function formatRate(rateBasisPoints: number): string {
  return `${(rateBasisPoints / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

/**
 * The note behind checkout's tax info button (D56): the rate or rates actually applied to these
 * lines, from the owner's tax classes, never a figure typed into the page. Shipping is never taxed (D34, D54).
 */
export function describeTax(classes: readonly (TaxClass | null)[], approved: boolean): string {
  const taxed = new Map<number, TaxClass>();
  for (const c of classes) if (c && c.rateBasisPoints > 0 && !taxed.has(c.rateBasisPoints)) taxed.set(c.rateBasisPoints, c);
  const rates = [...taxed.values()].sort((a, b) => a.rateBasisPoints - b.rateBasisPoints);
  let text: string;
  if (rates.length === 0) text = "No sales tax applies to the items in this order.";
  else if (rates.length === 1) text = `${rates[0].name.includes(formatRate(rates[0].rateBasisPoints)) ? rates[0].name : `${rates[0].name} ${formatRate(rates[0].rateBasisPoints)}`} on taxable items.`;
  else text = `Sales tax on taxable items, at ${rates.map((c) => formatRate(c.rateBasisPoints)).join(" or ")} depending on the item.`;
  text += " Shipping isn't taxed.";
  if (!approved) text += " The tax is an estimate until the shop confirms its tax settings.";
  return text;
}

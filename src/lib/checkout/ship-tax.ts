/**
 * Sales tax by the customer's ship-to state (D65). The shop is in Plymouth, MA and is registered to
 * collect Massachusetts sales tax only, so:
 *
 *   - pickup is taxed exactly as before, from the tax classes (D34);
 *   - an order shipped to a state in Settings → Checkout & reservations → Tax → "Tax by ship-to
 *     state" is taxed at that state's rate (a tax-exempt class, rate 0, stays exempt);
 *   - an order shipped anywhere else is charged no sales tax, and the Clover order says so with
 *     Clover's NO_TAX_APPLIED rate, so Clover never adds tax of its own.
 *
 * The list is prefilled with Massachusetts at the default class's rate, so pickup and MA shipping
 * charge exactly what they did before. Shipping itself is never taxed (D34, D54).
 *
 * Framework free: the checkout service, the pages and the tests all use these functions, so the
 * figure the customer sees and the figure the server charges come from the same rule.
 */
import type { TaxClass } from "./tax";
import { formatRate } from "./tax";

/** One row of "Tax by ship-to state". */
export type ShipTaxRule = {
  /** Two-letter state code, upper case. */
  state: string;
  rateBasisPoints: number;
  /** The name of the matching tax rate in Lody's Clover, or null for Clover's default ("Sales Tax"). */
  cloverTaxName: string | null;
};

/** How an order's tax is decided. */
export type TaxBasis =
  | { kind: "pickup" }
  | { kind: "state"; state: string; rateBasisPoints: number; cloverTaxName: string | null }
  | { kind: "none"; state: string };

/** Clover's built-in zero rate: a line carrying it is not taxed by Clover. */
export const CLOVER_NO_TAX_RATE = "NO_TAX_APPLIED";

/** The variant key for an unlisted state, used by the checkout pages. */
export const NO_TAX_VARIANT = "none";

export const SHIP_TAX_HELP = "Only add a state if the shop is registered to collect its sales tax.";

const STATE = /^[A-Z]{2}$/;
const PERCENT = /^(\d{1,3})(?:\.(\d{1,2}))?$/;

/** "6.25" → 625 basis points, parsed from the text so no float multiplication happens. Null if not a valid rate. */
export function percentToBasisPoints(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const m = PERCENT.exec(String(value).trim());
  if (!m) return null;
  const bp = Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
  return bp <= 10_000 ? bp : null;
}

/** 625 → 6.25 (for the admin's default value; exact for whole basis points). */
export const basisPointsToPercent = (bp: number): number => Number(formatRate(bp).replace("%", ""));

type SavedRow = { state?: string | null; ratePercent?: number | string | null; cloverTaxName?: string | null };

/**
 * The rules from the saved Checkout settings. A settings row that has never been saved (and has no
 * list) gets Massachusetts at the default class's rate, the behaviour before D65. A saved row uses
 * the list as staff left it, even empty (then every shipped order is untaxed). Rows with a bad
 * state or rate are skipped; the first row for a state wins.
 */
export function shipTaxRulesFrom(
  settings: { updatedAt?: string | null; shipTaxStates?: SavedRow[] | null } | null | undefined,
  defaultClass: TaxClass | null,
): ShipTaxRule[] {
  const rows = settings?.shipTaxStates;
  const saved = Boolean(settings?.updatedAt) || (Array.isArray(rows) && rows.length > 0);
  if (!saved) return defaultClass ? [{ state: "MA", rateBasisPoints: defaultClass.rateBasisPoints, cloverTaxName: null }] : [];
  const out: ShipTaxRule[] = [];
  for (const row of rows ?? []) {
    const state = String(row?.state ?? "").trim().toUpperCase();
    const rateBasisPoints = percentToBasisPoints(row?.ratePercent);
    if (!STATE.test(state) || rateBasisPoints === null || out.some((r) => r.state === state)) continue;
    const name = String(row?.cloverTaxName ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    out.push({ state, rateBasisPoints, cloverTaxName: name || null });
  }
  return out;
}

/** The tax basis for how the order is fulfilled. The state comes from the submitted address, never from a total the browser shows. */
export function taxBasisFor(place: { method: "pickup" } | { method: "ship"; state: string }, rules: readonly ShipTaxRule[]): TaxBasis {
  if (place.method !== "ship") return { kind: "pickup" };
  const state = String(place.state ?? "").trim().toUpperCase();
  const rule = rules.find((r) => r.state === state);
  return rule ? { kind: "state", state, rateBasisPoints: rule.rateBasisPoints, cloverTaxName: rule.cloverTaxName } : { kind: "none", state };
}

/**
 * A line's tax class as this basis taxes it. Pickup: unchanged. A listed state: its rate, except a
 * tax-exempt class (rate 0) stays exempt. Unlisted: rate 0. The class's approval never changes, so a
 * shipped order can't open checkout while the tax settings are unapproved (D34).
 */
export function classForBasis(taxClass: TaxClass | null, basis: TaxBasis): TaxClass | null {
  if (!taxClass || basis.kind === "pickup") return taxClass;
  if (basis.kind === "none") return { ...taxClass, rateBasisPoints: 0 };
  return { ...taxClass, rateBasisPoints: taxClass.rateBasisPoints === 0 ? 0 : basis.rateBasisPoints };
}

/**
 * The tax row's label on checkout, the order page and emails: "Tax" for pickup (as before),
 * "Tax (MA 6.25%)" for a listed state, "No sales tax (ships to NY)" otherwise. An unapproved
 * class keeps the D34 "Estimated tax (to be confirmed)" wording.
 */
export function taxLabelFor(basis: TaxBasis, approved: boolean): string {
  if (basis.kind === "none") return `No sales tax (ships to ${basis.state})`;
  if (basis.kind === "state") return approved ? `Tax (${basis.state} ${formatRate(basis.rateBasisPoints)})` : `Estimated tax (${basis.state} ${formatRate(basis.rateBasisPoints)}, to be confirmed)`;
  return approved ? "Tax" : "Estimated tax (to be confirmed)";
}

/** The key the checkout pages use for a basis: the state code for a listed state, "none" for any other. */
export function variantOf(basis: TaxBasis): string {
  return basis.kind === "state" ? basis.state : basis.kind === "none" ? NO_TAX_VARIANT : "pickup";
}

/** Every shipped basis a page needs to show: one per listed state, then "no tax". */
export function shippedBases(rules: readonly ShipTaxRule[]): { key: string; basis: TaxBasis }[] {
  return [
    ...rules.map((r) => ({ key: r.state, basis: { kind: "state", state: r.state, rateBasisPoints: r.rateBasisPoints, cloverTaxName: r.cloverTaxName } as TaxBasis })),
    // The page shows "ships to …" with the state the customer picks; the label is filled in in the browser.
    { key: NO_TAX_VARIANT, basis: { kind: "none", state: "" } as TaxBasis },
  ];
}

/** What the payment provider is told about the tax (Clover's rate name, or "no tax"). */
export type ProviderTax = { kind: "default" } | { kind: "named"; cloverTaxName: string | null } | { kind: "none" };

export function providerTaxFor(basis: TaxBasis): ProviderTax {
  if (basis.kind === "none") return { kind: "none" };
  if (basis.kind === "state") return { kind: "named", cloverTaxName: basis.cloverTaxName };
  return { kind: "default" };
}

/** The tax info note for a shipped basis; null for pickup, which keeps `describeTax` (D56). */
export function describeBasisNote(basis: TaxBasis): string | null {
  if (basis.kind === "none") return `No sales tax: the order ships to ${basis.state || "a state"} the shop doesn't collect sales tax for. Shipping isn't taxed.`;
  if (basis.kind === "state") return `${basis.state} sales tax ${formatRate(basis.rateBasisPoints)} on taxable items, for orders shipped to ${basis.state}. Shipping isn't taxed.`;
  return null;
}

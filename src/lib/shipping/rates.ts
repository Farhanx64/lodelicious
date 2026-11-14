/**
 * Shipping charges (D54). Pure and framework free, integer cents.
 *
 * - Regular products ship at one flat rate per order.
 * - Gift baskets ship at a rate for their size (small, medium, large, anything larger).
 * - An order pays ONE charge: the highest single rate that applies to anything in it. A mixed bag
 *   of chocolates and a large basket pays the large-basket rate, never flat + basket.
 * - Pickup is always free.
 * - An order can ship only if every item can: ticked "Can ship" and not perishable. Otherwise the
 *   customer is told which items keep it to pickup.
 * - Boxes by weight (D60): every shippable quote also says which box the order fits. With "Charge by
 *   box" on, that box's price is the charge; with it off, or when no box is picked (an item without a
 *   weight, too heavy, no boxes), the rules above apply exactly.
 */
import { assertCents, type Cents } from "../money";
import { boxesFrom, pickBox, type Packing, type ShipBox } from "./boxes";

export const DEFAULT_SHIPPING = {
  shippingEnabled: true,
  flatRateCents: 895,
  basketSmallCents: 1000,
  basketMediumCents: 1500,
  basketLargeCents: 2000,
  basketLargerCents: 2500,
  chargeByBox: false,
} as const;

export type ShippingRates = {
  shippingEnabled: boolean;
  flatRateCents: Cents;
  basketSmallCents: Cents;
  basketMediumCents: Cents;
  basketLargeCents: Cents;
  basketLargerCents: Cents;
  /** Charge the picked box's price instead of the rates above (D60). Off until Lody switches it on. */
  chargeByBox: boolean;
  boxes: ShipBox[];
};

/** "larger" is Extra large and any bigger size added later. */
export type BasketShipSize = "small" | "medium" | "large" | "larger";

export type ShipItem = {
  title: string;
  /** False when the product is not ticked "Can ship", or is perishable / prepared. */
  shippable: boolean;
  /** How many of it are in the box (D60). Defaults to 1. */
  quantity?: number;
  /** Its shipping weight in pounds; null or missing when nobody has entered one (D60). */
  weightLbs?: number | null;
} & ({ kind: "regular" } | { kind: "basket"; size: BasketShipSize });

export type ShippingQuote =
  | { available: true; cents: Cents; packing: Packing; chargedBy: "box" | "rules" }
  | { available: false; reason: "disabled" | "empty" | "not_shippable"; blockers: string[] };

export type FulfillmentMethod = "pickup" | "ship";

const cents = (value: unknown, fallback: Cents): Cents => (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : fallback);

/** The admin's Shipping settings, with the defaults for anything missing or malformed. */
export function ratesFrom(doc: (Partial<Record<keyof ShippingRates, unknown>> & { updatedAt?: unknown }) | null | undefined): ShippingRates {
  const d = doc ?? {};
  return {
    shippingEnabled: d.shippingEnabled !== false,
    flatRateCents: cents(d.flatRateCents, DEFAULT_SHIPPING.flatRateCents),
    basketSmallCents: cents(d.basketSmallCents, DEFAULT_SHIPPING.basketSmallCents),
    basketMediumCents: cents(d.basketMediumCents, DEFAULT_SHIPPING.basketMediumCents),
    basketLargeCents: cents(d.basketLargeCents, DEFAULT_SHIPPING.basketLargeCents),
    basketLargerCents: cents(d.basketLargerCents, DEFAULT_SHIPPING.basketLargerCents),
    chargeByBox: d.chargeByBox === true,
    // Never saved (no row yet): Lody's boxes. A saved row's list is what staff left, even empty (D60).
    boxes: boxesFrom(d.updatedAt || (Array.isArray(d.boxes) && d.boxes.length) ? (d.boxes ?? []) : undefined),
  };
}

/** A Build a Basket size code (gift builder settings) as a shipping size. Unknown or bigger codes are "larger". */
export function basketSizeFromCode(code: string | null | undefined): BasketShipSize {
  return code === "small" || code === "medium" || code === "large" ? code : "larger";
}

/**
 * A ready-made basket's size from its name or slug ("Medium Sympathy Basket", "extra-large-gift-basket").
 * "Extra large" is checked before "large". A basket with no size word is charged the larger rate, so
 * an unexpected name never ships for less than it costs.
 */
export function basketSizeFromName(name: string | null | undefined): BasketShipSize {
  const n = ` ${String(name ?? "").toLowerCase().replace(/[^a-z]+/g, " ")} `;
  if (/ (extra large|x large|xl) /.test(n)) return "larger";
  if (/ large /.test(n)) return "large";
  if (/ medium /.test(n)) return "medium";
  if (/ small /.test(n)) return "small";
  return "larger";
}

/** The rate one item would cost on its own. */
export function rateFor(item: ShipItem, rates: ShippingRates): Cents {
  if (item.kind === "regular") return rates.flatRateCents;
  return { small: rates.basketSmallCents, medium: rates.basketMediumCents, large: rates.basketLargeCents, larger: rates.basketLargerCents }[item.size];
}

/** What shipping this order costs: the highest single applicable rate, or why it can't ship. */
export function quoteShipping(items: readonly ShipItem[], rates: ShippingRates): ShippingQuote {
  if (!rates.shippingEnabled) return { available: false, reason: "disabled", blockers: [] };
  if (items.length === 0) return { available: false, reason: "empty", blockers: [] };
  const blockers = [...new Set(items.filter((i) => !i.shippable).map((i) => i.title))];
  if (blockers.length > 0) return { available: false, reason: "not_shippable", blockers };
  const byRules = assertCents(Math.max(...items.map((i) => rateFor(i, rates))));
  const packing = pickBox(
    items.map((i) => ({ title: i.title, quantity: i.quantity ?? 1, weightLbs: i.weightLbs })),
    rates.boxes,
  );
  if (rates.chargeByBox && packing.box) return { available: true, cents: assertCents(packing.box.priceCents), packing, chargedBy: "box" };
  return { available: true, cents: byRules, packing, chargedBy: "rules" };
}

/** Whether a product may ship under the current rules: ticked "Can ship" and not perishable. */
export function productShips(product: { shippable?: boolean | null; perishable?: boolean | null }): boolean {
  return product.shippable === true && product.perishable !== true;
}

/** Plain sentence for the customer when shipping isn't offered for this order. */
export function whyNoShipping(quote: Extract<ShippingQuote, { available: false }>): string {
  if (quote.reason === "not_shippable") return `Pickup only: ${quote.blockers.join(", ")} can't be shipped.`;
  return "Pickup only for now.";
}

// ---------------------------------------------------------------- address

export type ShippingAddress = { name: string; line1: string; line2: string; city: string; state: string; zip: string };

const STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR".split(" "),
);

/** A US delivery address from the checkout form, or the first thing wrong with it. */
export function parseAddress(form: Record<string, unknown>, fallbackName: string): { ok: true; address: ShippingAddress } | { ok: false; error: string } {
  const get = (k: string, max: number) => String(form[k] ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
  const name = get("shipName", 100) || fallbackName;
  const line1 = get("shipLine1", 120);
  const line2 = get("shipLine2", 120);
  const city = get("shipCity", 60);
  const state = get("shipState", 2).toUpperCase();
  const zip = get("shipZip", 10);
  if (!line1) return { ok: false, error: "Please enter the street address to ship to." };
  if (!city) return { ok: false, error: "Please enter the town or city to ship to." };
  if (!STATES.has(state)) return { ok: false, error: "Please choose the state to ship to (we ship within the US)." };
  if (!/^\d{5}(-\d{4})?$/.test(zip)) return { ok: false, error: "Please enter a 5-digit ZIP code." };
  return { ok: true, address: { name, line1, line2, city, state, zip } };
}

export function formatAddress(a: ShippingAddress): string {
  return [a.name, a.line1, a.line2, `${a.city}, ${a.state} ${a.zip}`].filter(Boolean).join(", ");
}

export const US_STATES = [...STATES].sort();

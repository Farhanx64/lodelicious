/**
 * Shipping boxes by weight (D60). Pure and framework free.
 *
 * - Each product may carry a shipping weight in pounds (decimals allowed). An order's weight is the
 *   sum of quantity × weight over its lines; a custom basket adds its empty basket & packaging weight.
 * - The box is the smallest one whose maximum weight holds the order (lowest maximum first, then the
 *   cheaper of two equal maximums). Dimensions are shown to staff; they don't decide the fit.
 * - No box is picked when any item has no weight, when the order is heavier than the largest box, or
 *   when the box list is empty. Shipping is then charged by the D54 rules exactly.
 *
 * Weights are worked in hundredths of a pound (integers) so adding them up never drifts.
 */
import type { Cents } from "../money";

export type ShipBox = {
  name: string;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  maxWeightLbs: number;
  priceCents: Cents;
};

/**
 * Lody's four boxes (2026-11-13). The upper end of each weight range she gave is the box's maximum.
 * Prices are the D54 basket rates for the same size, so switching box pricing on changes nothing
 * for a basket order until she edits them.
 */
export const DEFAULT_BOXES: readonly ShipBox[] = [
  { name: "Small box", lengthIn: 14, widthIn: 9, heightIn: 14, maxWeightLbs: 3, priceCents: 1000 },
  { name: "Medium box", lengthIn: 16, widthIn: 10, heightIn: 16, maxWeightLbs: 4, priceCents: 1500 },
  { name: "Large box", lengthIn: 18, widthIn: 12, heightIn: 20, maxWeightLbs: 6, priceCents: 2000 },
  { name: "Extra large box", lengthIn: 22, widthIn: 22, heightIn: 18, maxWeightLbs: 7, priceCents: 2500 },
];

/** One thing going in the box: `weightLbs` null or missing means nobody has entered its weight. */
export type WeighedItem = { title: string; quantity: number; weightLbs: number | null | undefined };

export type Packing =
  | { box: ShipBox; weightLbs: number }
  | { box: null; reason: "missing_weight"; missing: string[] }
  | { box: null; reason: "too_heavy"; weightLbs: number; heaviestLbs: number }
  | { box: null; reason: "no_boxes" };

const hundredths = (lbs: number) => Math.round(lbs * 100);

/** A usable weight: a finite number above zero. Anything else counts as "no weight entered". */
export function validWeight(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

const positive = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0;
const size = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

/**
 * The boxes from Settings → Shipping. A settings row saved before boxes existed (`boxes` absent)
 * uses Lody's defaults; an empty list means "no boxes" and keeps the D54 rules. Rows without a
 * name, a maximum weight above zero or a whole-cents price are skipped.
 */
export function boxesFrom(rows: unknown): ShipBox[] {
  if (rows === undefined) return DEFAULT_BOXES.map((b) => ({ ...b }));
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r): ShipBox[] => {
    const row = (r ?? {}) as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const price = row.priceCents;
    if (!name || !positive(row.maxWeightLbs) || !(typeof price === "number" && Number.isSafeInteger(price) && price >= 0)) return [];
    return [{ name, lengthIn: size(row.lengthIn), widthIn: size(row.widthIn), heightIn: size(row.heightIn), maxWeightLbs: row.maxWeightLbs as number, priceCents: price }];
  });
}

/** Total weight in pounds, or the titles (once each) of the items that have no weight. */
export function orderWeight(items: readonly WeighedItem[]): { ok: true; weightLbs: number } | { ok: false; missing: string[] } {
  const missing = [...new Set(items.filter((i) => validWeight(i.weightLbs) === null).map((i) => i.title))];
  if (missing.length) return { ok: false, missing };
  const total = items.reduce((sum, i) => sum + hundredths(i.weightLbs as number) * Math.max(0, Math.trunc(i.quantity)), 0);
  return { ok: true, weightLbs: total / 100 };
}

/** The smallest box that holds these items, or why there isn't one. */
export function pickBox(items: readonly WeighedItem[], boxes: readonly ShipBox[]): Packing {
  if (boxes.length === 0) return { box: null, reason: "no_boxes" };
  const weight = orderWeight(items);
  if (!weight.ok) return { box: null, reason: "missing_weight", missing: weight.missing };
  const total = hundredths(weight.weightLbs);
  const bySize = [...boxes].sort((a, b) => hundredths(a.maxWeightLbs) - hundredths(b.maxWeightLbs) || a.priceCents - b.priceCents);
  const box = bySize.find((b) => hundredths(b.maxWeightLbs) >= total);
  if (!box) return { box: null, reason: "too_heavy", weightLbs: weight.weightLbs, heaviestLbs: bySize[bySize.length - 1].maxWeightLbs };
  return { box, weightLbs: weight.weightLbs };
}

const n = (v: number) => String(Number(v.toFixed(2)));

/** "Medium box, 16 × 10 × 16 in" */
export function boxLabel(box: ShipBox): string {
  const dims = [box.lengthIn, box.widthIn, box.heightIn];
  return dims.every((d) => d > 0) ? `${box.name}, ${dims.map(n).join(" × ")} in` : box.name;
}

/** What staff read on a shipped order: the box to pack, or why they must choose one by hand. */
export function packingNote(packing: Packing): string {
  if (packing.box) return boxLabel(packing.box);
  if (packing.reason === "missing_weight") return `Choose a box by hand: no shipping weight for ${packing.missing.join(", ")}`;
  if (packing.reason === "too_heavy") return `Choose a box by hand: ${n(packing.weightLbs)} lbs is over the largest box (${n(packing.heaviestLbs)} lbs)`;
  return "Choose a box by hand: no boxes are set up";
}

/** The order's weight when every item had one, for the record. */
export function packingWeight(packing: Packing): number | null {
  return packing.box ? packing.weightLbs : packing.reason === "too_heavy" ? packing.weightLbs : null;
}

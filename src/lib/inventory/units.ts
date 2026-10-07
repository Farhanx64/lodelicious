/**
 * Units, shopping lists and the bill of materials (INV 01). A unit is `productId` or
 * `productId:variantKey`, the same id carts and gifts already use.
 */
import type { PlanLine, UnitRef } from "./types";

export function unitKey(unit: UnitRef): string {
  return unit.variantKey ? `${unit.productId}:${unit.variantKey}` : unit.productId;
}

export function parseUnitId(id: string): UnitRef {
  const [productId, variantKey] = String(id).split(":") as [string, string?];
  return { productId, variantKey: variantKey ? variantKey : null };
}

/** Sum repeated units, drop non-positive or fractional quantities, and order deterministically. */
export function mergePlan(lines: readonly PlanLine[]): PlanLine[] {
  const merged = new Map<string, PlanLine>();
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) continue;
    const key = unitKey(line);
    const existing = merged.get(key);
    if (existing) existing.quantity += line.quantity;
    else merged.set(key, { productId: line.productId, variantKey: line.variantKey, quantity: line.quantity });
  }
  return [...merged.values()].sort((a, b) => (unitKey(a) < unitKey(b) ? -1 : unitKey(a) > unitKey(b) ? 1 : 0));
}

export type BomComponent = { productId: string; variantKey: string | null; quantity: number };

type RawComponent = { product?: unknown; variantKey?: string | null; quantity?: number | null };

const relId = (v: unknown): string | null => (v === null || v === undefined ? null : typeof v === "object" ? String((v as { id: unknown }).id) : String(v));

/** A product's bill of materials from its admin document. Empty when it has none. */
export function bomOf(product: { components?: readonly RawComponent[] | null } | null | undefined): BomComponent[] {
  const out: BomComponent[] = [];
  for (const c of product?.components ?? []) {
    const productId = relId(c.product);
    if (!productId || !Number.isSafeInteger(c.quantity) || (c.quantity as number) <= 0) continue;
    out.push({ productId, variantKey: c.variantKey ? c.variantKey : null, quantity: c.quantity as number });
  }
  return out;
}

/**
 * What a sale of `lines` takes off the shelf. A product with a bill of materials is sold from its
 * components and never from its own count; anything else is sold from itself (INV 01: each
 * component is deducted once, never both a finished basket and its parts).
 */
export function planFor(lines: readonly { unitId: string; quantity: number }[], components: (productId: string) => BomComponent[]): PlanLine[] {
  const out: PlanLine[] = [];
  for (const line of lines) {
    const unit = parseUnitId(line.unitId);
    const parts = components(unit.productId);
    if (parts.length === 0) out.push({ ...unit, quantity: line.quantity });
    else for (const part of parts) out.push({ productId: part.productId, variantKey: part.variantKey, quantity: part.quantity * line.quantity });
  }
  return mergePlan(out);
}

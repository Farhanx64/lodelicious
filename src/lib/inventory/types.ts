/**
 * Inventory vocabulary shared by the schema, the ledger and the storefront (D40). Framework free.
 */

/** Why a movement happened. Holds are not movements: they never change the counted quantity. */
export const MOVEMENT_REASONS = ["sale", "reservation", "cancel_restock", "count_correction", "manual_adjustment", "sync"] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

/** Inbound Clover reads must not be echoed back to Clover, so they get no outbox event. */
export function enqueuesOutbox(reason: MovementReason): boolean {
  return reason !== "sync";
}

export const HOLD_STATUSES = ["active", "converted", "released", "expired"] as const;
export type HoldStatus = (typeof HOLD_STATUSES)[number];

export const OUTBOX_EVENT_TYPES = ["stock_changed"] as const;
export const OUTBOX_STATUSES = ["pending", "sent", "failed", "dead"] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

/** Where a paid record stands with the shelf. Customers never see this. */
export const STOCK_STATUSES = ["none", "held", "committed", "needs_attention", "released", "resolved"] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const ADJUSTMENT_KINDS = ["count", "adjust", "cancel_restock"] as const;
export type AdjustmentKind = (typeof ADJUSTMENT_KINDS)[number];

/** One sellable unit: a product, or one option of it. */
export type UnitRef = { productId: string; variantKey: string | null };

/** What a sale, reservation or restock moves: whole units of one component. */
export type PlanLine = UnitRef & { quantity: number };

export const DEFAULT_HOLD_MINUTES = 15;

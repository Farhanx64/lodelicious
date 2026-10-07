import crypto from "node:crypto";

import { APIError, type CollectionBeforeChangeHook, type Payload } from "payload";

import type { Order, Product, Reservation } from "@/payload-types";

import { canManageCommerce } from "../access/roles";
import { GuardFailed } from "../lib/inventory/db";
import { applyMovements, movementKey, recordedQuantities, type MovementInput } from "../lib/inventory/ledger";
import { parsePlan, recordKeyOf } from "../lib/inventory/records";
import { checkPerishables, checkRestock } from "../lib/inventory/restock";
import type { PlanLine, UnitRef } from "../lib/inventory/types";
import { unitKey } from "../lib/inventory/units";

function fail(message: string, status = 400): never {
  throw new APIError(message, status, undefined, true);
}

const idOf = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : typeof v === "object" ? String((v as { id: unknown }).id) : String(v));

async function loadProduct(payload: Payload, id: string): Promise<Product> {
  const product = await payload.findByID({ collection: "products", id, depth: 0, overrideAccess: true }).catch(() => null);
  if (!product) fail("That product no longer exists.");
  return product as Product;
}

/** A unit must name a real option when the product has options, and none when it doesn't. */
function unitOf(product: Product, variantKey: unknown): UnitRef {
  const key = typeof variantKey === "string" && variantKey.trim() ? variantKey.trim() : null;
  const options = product.variants ?? [];
  if (options.length > 0 && !options.some((v) => v.key === key)) fail(`${product.title} has options (${options.map((v) => v.key).join(", ")}). Enter which one.`);
  if (options.length === 0 && key) fail(`${product.title} has no options, so leave Option empty.`);
  return { productId: String(product.id), variantKey: key };
}

async function apply(payload: Payload, inputs: MovementInput[], now: Date) {
  try {
    return await applyMovements(payload, inputs, now);
  } catch (e) {
    if (e instanceof GuardFailed) fail("That would take a count below zero, or the stock was never counted. Record a count first, then adjust.");
    throw e;
  }
}

/**
 * Runs the stock change when staff save a new adjustment. A refused change throws, so no
 * adjustment is saved either and the product's stock is untouched.
 */
export const applyAdjustment: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== "create") return data;
  const user = req.user;
  if (!user) fail("Sign in to record stock changes.", 401);
  const payload = req.payload;
  const userId = typeof user!.id === "number" ? user!.id : Number(user!.id);
  const canManage = canManageCommerce(user as { roles?: ("owner" | "manager" | "fulfillment")[] | null });
  const note = String(data.note ?? "").trim();
  if (!note) fail("Please say why, so the record is useful later.");
  const requestId = crypto.randomUUID();
  const now = new Date();
  const kind = data.kind as "count" | "adjust" | "cancel_restock";

  if (kind === "count" || kind === "adjust") {
    if (!canManage) fail("Only the owner or a manager can record counts and adjustments.", 403);
    const productId = idOf(data.product);
    if (!productId) fail("Choose the product.");
    const product = await loadProduct(payload, productId!);
    const unit = unitOf(product, data.variantKey);
    const reference = `adjustment ${requestId.slice(0, 8)}`;
    let input: MovementInput;
    if (kind === "count") {
      const counted = data.countedQuantity;
      if (typeof counted !== "number" || !Number.isSafeInteger(counted) || counted < 0) fail("Enter the counted quantity as a whole number, 0 or more.");
      input = { unit, mode: "count", amount: counted, reason: "count_correction", idempotencyKey: movementKey("adjustment", requestId, unit), reference, userId, note };
    } else {
      const delta = data.delta;
      if (typeof delta !== "number" || !Number.isSafeInteger(delta) || delta === 0) fail("Enter the change as a whole number other than 0, such as 12 or -2.");
      input = { unit, mode: "delta", amount: delta, reason: "manual_adjustment", idempotencyKey: movementKey("adjustment", requestId, unit), reference, userId, note };
    }
    const result = await apply(payload, [input], now);
    return { ...data, variantKey: unit.variantKey ?? "", user: userId, requestId, result };
  }

  if (kind !== "cancel_restock") fail("Choose what kind of stock change this is.");

  const orderId = idOf(data.order);
  const reservationId = idOf(data.reservation);
  if (Boolean(orderId) === Boolean(reservationId)) fail("Choose either the order or the reservation being put back (not both).");
  const isOrder = Boolean(orderId);
  const record = (await payload
    .findByID({ collection: isOrder ? "orders" : "reservations", id: (orderId ?? reservationId)!, depth: 0, overrideAccess: true })
    .catch(() => null)) as Order | Reservation | null;
  if (!record) fail("That order or reservation no longer exists.");
  const rec = record!;
  const recordKey = recordKeyOf(rec);

  const requested: PlanLine[] = [];
  const names = new Map<string, string>();
  const perishable: string[] = [];
  for (const line of (data.restockLines ?? []) as { product?: unknown; variantKey?: string | null; quantity?: number }[]) {
    const pid = idOf(line.product);
    if (!pid || typeof line.quantity !== "number") continue;
    const product = await loadProduct(payload, pid);
    const unit = unitOf(product, line.variantKey);
    requested.push({ ...unit, quantity: line.quantity });
    names.set(unitKey(unit), unit.variantKey ? `${product.title} (${unit.variantKey})` : product.title);
    if (product.perishable && !perishable.includes(product.title)) perishable.push(product.title);
  }

  const { sold, restocked } = await recordedQuantities(payload, { saleReason: isOrder ? "sale" : "reservation", recordKey });
  const checked = checkRestock(requested, sold, restocked, (l) => names.get(unitKey(l)) ?? unitKey(l));
  if (!checked.ok) fail(checked.error);
  const perishables = checkPerishables(perishable, canManage, Boolean(data.confirmPerishable));
  if (!perishables.ok) fail(perishables.error, canManage ? 400 : 403);

  const stored = parsePlan((rec as { stockPlan?: unknown }).stockPlan);
  if (stored.length === 0 && sold.size === 0) fail("This record didn't take anything from stock.");

  const inputs: MovementInput[] = (checked as { ok: true; lines: PlanLine[] }).lines.map((line) => ({
    unit: { productId: line.productId, variantKey: line.variantKey },
    mode: "delta" as const,
    amount: line.quantity,
    reason: "cancel_restock" as const,
    idempotencyKey: movementKey("cancel_restock", `${recordKey}:${requestId}`, line),
    reference: rec.number,
    userId,
    note,
  }));
  const result = await apply(payload, inputs, now);
  return { ...data, user: userId, requestId, result };
};

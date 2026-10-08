/**
 * Helpers for the Clover sync integration tests: products with Clover IDs and website stock changes
 * that queue outbox events, exactly as a paid sale or a staff adjustment does.
 */
import type { Payload } from "payload";

import type { Product } from "@/payload-types";
import { query } from "@/src/lib/inventory/db";
import { applyMovements } from "@/src/lib/inventory/ledger";

import { makeProduct, NOW, type ProductSpec, type World } from "./inventory-fixtures";

export { NOW };

export async function cloverProduct(world: Pick<World, "payload" | "category">, cloverId: string | null, spec: ProductSpec = {}): Promise<Product> {
  const p = await makeProduct(world, spec);
  if (cloverId === null) return p;
  await world.payload.update({ collection: "products", id: p.id, data: { cloverId } as never, overrideAccess: true });
  return p;
}

let n = 0;

/** A website stock change that queues a `stock_changed` outbox row (like a sale does). */
export async function websiteSale(payload: Payload, productId: number | string, quantity: number, opts: { variantKey?: string | null; now?: Date } = {}): Promise<string> {
  const key = `test-sale-${++n}`;
  await applyMovements(
    payload,
    [{ unit: { productId: String(productId), variantKey: opts.variantKey ?? null }, mode: "delta", amount: -quantity, reason: "manual_adjustment", idempotencyKey: key }],
    opts.now ?? NOW,
  );
  return `stock_changed:${key}`;
}

export type OutboxRow = { id: number; status: string; attempts: number; next: string | null; sentAt: string | null; err: string | null; key: string };

export async function outboxRow(payload: Payload, key: string): Promise<OutboxRow> {
  const [r] = await query(payload, "SELECT id, status, attempts, next_attempt_at AS n, sent_at AS s, last_error AS e, idempotency_key AS k FROM outbox WHERE idempotency_key = :k", { k: key });
  return { id: Number(r.id), status: String(r.status), attempts: Number(r.attempts), next: r.n ? String(r.n) : null, sentAt: r.s ? String(r.s) : null, err: r.e ? String(r.e) : null, key: String(r.k) };
}

export const minutes = (m: number) => m * 60_000;

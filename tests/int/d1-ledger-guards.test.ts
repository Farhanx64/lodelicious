/**
 * The stock ledger's guarantees on D1 (D51). `src/lib/inventory/db.ts` was written for libsql; on
 * Cloudflare the same statements run through a D1 binding. These tests run them against wrangler's
 * D1 emulation (in memory, nothing is read from or written to .wrangler/) and check the things the
 * ledger relies on: a batch is all-or-nothing, the "nothing changed" guard aborts it, a repeated
 * idempotency key is recognised, and named parameters and row counts come through.
 */
import type { Payload } from "payload";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";

import { ABORT_IF_NOTHING_CHANGED, AlreadyApplied, GuardFailed, query, runBatch } from "../../src/lib/inventory/db";

let proxy: Awaited<ReturnType<typeof getPlatformProxy>>;
let payload: Payload;

beforeAll(async () => {
  proxy = await getPlatformProxy({ persist: false });
  const d1 = (proxy.env as { D1: { exec(sql: string): Promise<unknown> } }).D1;
  payload = { db: { client: d1 } } as unknown as Payload;
  // The two tables the guards name, cut down to the columns used here.
  await d1.exec("CREATE TABLE products (id integer PRIMARY KEY, stock integer NOT NULL)");
  await d1.exec("CREATE TABLE stock_movements (id integer PRIMARY KEY, idempotency_key text NOT NULL UNIQUE, product_id integer NOT NULL, delta integer NOT NULL)");
  await d1.exec("INSERT INTO products (id, stock) VALUES (1, 3)");
});

afterAll(async () => {
  await proxy?.dispose();
});

const stock = async () => Number((await query(payload, "SELECT stock FROM products WHERE id = :id", { id: 1 }))[0].stock);
const movements = async () => Number((await query(payload, "SELECT count(*) AS n FROM stock_movements"))[0].n);

/** Take `qty` from product 1 only if that much is there, and record the movement, as the ledger does. */
const take = (qty: number, key: string) =>
  runBatch(payload, [
    { sql: "INSERT INTO stock_movements (idempotency_key, product_id, delta) VALUES (:key, :pid, :delta)", args: { key, pid: 1, delta: -qty } },
    { sql: "UPDATE products SET stock = stock - :qty WHERE id = :pid AND stock >= :qty", args: { qty, pid: 1 } },
    ABORT_IF_NOTHING_CHANGED,
  ]);

describe("the stock ledger's write batches on D1", () => {
  it("applies a batch whose guard passes and reports the rows it changed", async () => {
    const results = await take(2, "order-1");
    expect(results[0].rowsAffected).toBe(1);
    expect(results[1].rowsAffected).toBe(1);
    expect(await stock()).toBe(1);
    expect(await movements()).toBe(1);
  });

  it("rolls the whole batch back when the guarded statement changes nothing (no overselling)", async () => {
    await expect(take(2, "order-2")).rejects.toBeInstanceOf(GuardFailed);
    expect(await stock()).toBe(1);
    // The movement written earlier in the same batch is gone too.
    expect(await movements()).toBe(1);
  });

  it("recognises a repeated idempotency key and changes nothing", async () => {
    await expect(take(1, "order-1")).rejects.toBeInstanceOf(AlreadyApplied);
    expect(await stock()).toBe(1);
    expect(await movements()).toBe(1);
  });

  it("reports zero rows for an update that matches nothing, which the job lock depends on", async () => {
    const [result] = await runBatch(payload, [{ sql: "UPDATE products SET stock = :s WHERE id = :id", args: { s: 9, id: 999 } }]);
    expect(result.rowsAffected).toBe(0);
  });
});

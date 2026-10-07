/**
 * Database access for the stock ledger (D40).
 *
 * Why raw statements and `client.batch`: Payload's transactions are switched off for SQLite here
 * (the adapter is created without `transactionOptions`, so `beginTransaction` returns null and
 * `req.transactionID` is never set), and `client.transaction()` makes libsql open a second
 * connection for every other caller while it is open, which then fail with SQLITE_BUSY. `batch`
 * is different: libsql runs BEGIN IMMEDIATE, every statement and COMMIT in one synchronous call.
 * Nothing in this process can run between the statements, and other processes (the cron scripts)
 * are serialised by SQLite's write lock. A statement that must not be skipped is followed by
 * `ABORT_IF_NOTHING_CHANGED`, which raises an error (so the whole batch rolls back) when the
 * statement before it changed no row.
 */
import type { Payload } from "payload";

export type Stmt = string | { sql: string; args?: Record<string, unknown> };

type ResultSet = { rowsAffected: number; rows: Record<string, unknown>[] };

type LibsqlClient = {
  batch(stmts: Stmt[], mode: "write" | "read" | "deferred"): Promise<ResultSet[]>;
  execute(stmt: Stmt): Promise<ResultSet>;
};

export function client(payload: Payload): LibsqlClient {
  const c = (payload.db as unknown as { client?: LibsqlClient }).client;
  if (!c) throw new Error("The database client isn't ready");
  return c;
}

/** `abs` of the smallest integer raises "integer overflow": SQLite's way of failing on purpose. */
export const ABORT_IF_NOTHING_CHANGED: Stmt = "SELECT CASE WHEN changes() = 0 THEN abs(-9223372036854775808) END";

export class GuardFailed extends Error {
  constructor() {
    super("A stock condition was not met");
    this.name = "GuardFailed";
  }
}

export class AlreadyApplied extends Error {
  constructor() {
    super("This stock change was already recorded");
    this.name = "AlreadyApplied";
  }
}

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export const isBusy = (e: unknown): boolean => /SQLITE_BUSY|database is locked/i.test(messageOf(e));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run statements as one atomic write. Throws GuardFailed or AlreadyApplied; retries when another process holds the lock. */
export async function runBatch(payload: Payload, stmts: Stmt[]): Promise<ResultSet[]> {
  const db = client(payload);
  const delays = [10, 25, 60, 120, 250, 500, 1000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.batch(stmts, "write");
    } catch (e) {
      const message = messageOf(e);
      if (/integer overflow/i.test(message)) throw new GuardFailed();
      if (/UNIQUE constraint failed: (stock_movements\.idempotency_key|outbox\.idempotency_key)/i.test(message)) throw new AlreadyApplied();
      if (!isBusy(e) || attempt >= delays.length) throw e;
      await sleep(delays[attempt] + Math.floor(Math.random() * delays[attempt]));
    }
  }
}

export async function query(payload: Payload, sql: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>[]> {
  const db = client(payload);
  for (let attempt = 0; ; attempt++) {
    try {
      return (await db.execute({ sql, args })).rows;
    } catch (e) {
      if (!isBusy(e) || attempt >= 4) throw e;
      await sleep(20 * (attempt + 1));
    }
  }
}

export const iso = (d: Date): string => d.toISOString();

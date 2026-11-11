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
 *
 * On Cloudflare the client is a D1 binding, not libsql (D51). `client()` wraps it so the rest of
 * this file, and every caller, is unchanged: see `d1Client`.
 */
import type { Payload } from "payload";

export type Stmt = string | { sql: string; args?: Record<string, unknown> };

type ResultSet = { rowsAffected: number; rows: Record<string, unknown>[] };

type LibsqlClient = {
  batch(stmts: Stmt[], mode: "write" | "read" | "deferred"): Promise<ResultSet[]>;
  execute(stmt: Stmt): Promise<ResultSet>;
};

/** The parts of a D1 binding used here (the full type comes from `wrangler types`). */
type D1Statement = { bind(...values: unknown[]): D1Statement };
type D1Result = { results?: Record<string, unknown>[]; meta: { changes: number } };
type D1Client = {
  prepare(sql: string): D1Statement;
  batch(stmts: D1Statement[]): Promise<D1Result[]>;
};

/**
 * D1 takes only positional parameters, so `:name` becomes `?` and the values are listed in the
 * order they appear (a name used twice is bound twice). Quoted text is left alone, so a colon
 * inside a string literal is never mistaken for a parameter.
 */
export function toPositional(stmt: Stmt): { sql: string; values: unknown[] } {
  if (typeof stmt === "string") return { sql: stmt, values: [] };
  const args = stmt.args ?? {};
  const values: unknown[] = [];
  const sql = stmt.sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|`[^`]*`|:([A-Za-z_][A-Za-z0-9_]*)/g, (match, name: string | undefined) => {
    if (name === undefined) return match;
    if (!(name in args)) throw new Error(`No value was given for :${name}`);
    const value = args[name];
    // D1 rejects undefined, and stores true/false as text unless they are made numbers first.
    values.push(value === undefined ? null : typeof value === "boolean" ? Number(value) : value);
    return "?";
  });
  return { sql, values };
}

/**
 * The same two calls on a D1 binding (D51). `batch` is one transaction there too: D1 runs the
 * statements in order, and rolls every one of them back if any fails, so the guards in this file
 * (`ABORT_IF_NOTHING_CHANGED`, the unique idempotency keys) keep their meaning. There is no
 * SQLITE_BUSY to retry: D1 queues writers itself.
 */
function d1Client(db: D1Client): LibsqlClient {
  const prepare = (stmt: Stmt) => {
    const { sql, values } = toPositional(stmt);
    const prepared = db.prepare(sql);
    return values.length ? prepared.bind(...values) : prepared;
  };
  const toResultSet = (r: D1Result): ResultSet => ({ rowsAffected: r.meta.changes, rows: r.results ?? [] });
  return {
    batch: async (stmts) => (await db.batch(stmts.map(prepare))).map(toResultSet),
    execute: async (stmt) => toResultSet((await db.batch([prepare(stmt)]))[0]),
  };
}

const isD1 = (c: object): c is D1Client => typeof (c as D1Client).prepare === "function" && typeof (c as { execute?: unknown }).execute !== "function";

export function client(payload: Payload): LibsqlClient {
  const c = (payload.db as unknown as { client?: LibsqlClient | D1Client }).client;
  if (!c) throw new Error("The database client isn't ready");
  return isD1(c) ? d1Client(c) : c;
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
      if (/UNIQUE constraint failed: (stock_movements\.idempotency_key|outbox\.idempotency_key|reward_entries\.idempotency_key)/i.test(message)) throw new AlreadyApplied();
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

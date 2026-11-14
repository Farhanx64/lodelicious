/**
 * Print paid web orders on Lody's Clover device (D61). Switched off unless `CLOVER_ORDER_PRINT=on`.
 *
 * After a website payment succeeds, this
 *
 *   1. creates a plain Clover order with the Orders API (`POST /v3/merchants/{mId}/orders`, state
 *      "open", tax removed, title "WEB <number> PAID", a note with the order number, the customer's
 *      name and phone, the pickup time or ship-to address, the customer's note and "paid online");
 *   2. adds one custom line per bag line (`POST .../orders/{id}/bulk_line_items`): a name and a
 *      price only, never an inventory item, so Clover's stock and item list are never touched;
 *      shipping and the tax paid are lines of their own, so the slip adds up to what was charged;
 *   3. asks Clover to print it (`POST /v3/merchants/{mId}/print_event` with `orderRef.id`), which
 *      Clover sends to the device's order printer, or its built-in printer when there is none.
 *
 * The payment is NOT linked to this order. Clover only links an ecommerce charge to an order by
 * paying that order through the ecommerce API, which would move this step in front of the charge;
 * recording a second "payment" on it would count the sale twice in her reports. The slip says
 * "PAID ONLINE" and carries the ecommerce order id instead. See D61.
 *
 * Rules:
 *   - It never throws and never touches the record's payment: a Clover problem is logged, kept on a
 *     `sync-jobs` row (`clover-print:<collection>:<idempotency key>`) and retried by the
 *     send-pending-emails job, at most MAX_ATTEMPTS times.
 *   - At most one Clover order per web order: each step is saved on that row before and after its
 *     call, and a step whose answer was lost is looked up (by title, then its lines) before it is
 *     repeated. The paper itself is at-least-once: a lost print answer prints again.
 *   - Only records paid in the last PRINT_WINDOW_MS, so switching it on never prints old orders.
 *   - A sandbox payment prints only to the sandbox and a live one only to the live device.
 *   - The token goes only in the Authorization header and never into a message or log line.
 *
 * Written from Clover's public docs (read 2026-11-13); what must still be checked is in D61.
 */
import crypto from "node:crypto";

import type { Payload } from "payload";

import type { Order, Reservation } from "@/payload-types";

import { isProductionEnv, type EnvLike } from "../app-env";
import { iso, query, runBatch } from "../inventory/db";
import { formatCents } from "../money";

export type PrintCollection = "orders" | "reservations";
type PrintRecord = Order | Reservation;

export type CloverPrintEnvironment = "sandbox" | "production";

/** Clover's REST hosts for the merchant API (North America). */
export const CLOVER_REST_HOSTS: Record<CloverPrintEnvironment, string> = {
  sandbox: "https://apisandbox.dev.clover.com",
  production: "https://api.clover.com",
};

export type OrderPrintConfig = { environment: CloverPrintEnvironment; merchantId: string; token: string };

export type OrderPrintSetting = { kind: "off" } | { kind: "misconfigured"; reason: string } | { kind: "on"; config: OrderPrintConfig };

/** Only records paid this recently are printed (so turning the switch on never prints the backlog). */
export const PRINT_WINDOW_MS = 48 * 60 * 60_000;
/** Tries per record before it is left for staff (the email alert still went out). */
export const MAX_ATTEMPTS = 6;
/** One record's steps are locked this long, so the hook and the retry job never run it together. */
const LOCK_MS = 2 * 60_000;
const REQUEST_TIMEOUT_MS = 8_000;
/** Clover's limits are not published for every field; these keep well inside the ones that are. */
const NAME_MAX = 127;
const NOTE_MAX = 1000;
const TITLE_MAX = 60;

const ON = ["on", "true", "1", "yes"];

/**
 * Reads the switch and its settings. Never returns a value in a message.
 *
 * - `CLOVER_ORDER_PRINT=on` turns it on (anything else, or unset, is off).
 * - `CLOVER_ORDER_PRINT_TOKEN`: a merchant API token with "Orders: read and write" (Clover web
 *   dashboard → Account & Setup → API Tokens). Falls back to `CLOVER_API_TOKEN` (the D43 token).
 * - `CLOVER_MERCHANT_ID`, else `CLOVER_ECOMM_MERCHANT_ID`.
 * - `CLOVER_ORDER_PRINT_ENVIRONMENT`, else `CLOVER_ECOMM_ENVIRONMENT`: `sandbox` or `production`.
 *   The live store accepts only `production`.
 */
export function orderPrintSettingFrom(env: EnvLike): OrderPrintSetting {
  const get = (k: string) => (env[k] ?? "").trim();
  if (!ON.includes(get("CLOVER_ORDER_PRINT").toLowerCase())) return { kind: "off" };
  const bad = (reason: string): OrderPrintSetting => ({ kind: "misconfigured", reason });
  const token = get("CLOVER_ORDER_PRINT_TOKEN") || get("CLOVER_API_TOKEN");
  const merchantId = get("CLOVER_MERCHANT_ID") || get("CLOVER_ECOMM_MERCHANT_ID");
  const environment = (get("CLOVER_ORDER_PRINT_ENVIRONMENT") || get("CLOVER_ECOMM_ENVIRONMENT")).toLowerCase();
  if (!token) return bad("Clover order printing needs CLOVER_ORDER_PRINT_TOKEN (or CLOVER_API_TOKEN)");
  if (!merchantId) return bad("Clover order printing needs CLOVER_MERCHANT_ID (or CLOVER_ECOMM_MERCHANT_ID)");
  if (environment !== "sandbox" && environment !== "production") return bad('Clover order printing needs CLOVER_ORDER_PRINT_ENVIRONMENT (or CLOVER_ECOMM_ENVIRONMENT) set to "sandbox" or "production"');
  if (!/^[\w-]{8,200}$/.test(token)) return bad("CLOVER_ORDER_PRINT_TOKEN does not look like a Clover API token");
  if (!/^[A-Z0-9]{8,20}$/.test(merchantId)) return bad("CLOVER_MERCHANT_ID does not look like a Clover merchant id");
  if (environment === "sandbox" && isProductionEnv(env)) return bad("the live store prints only to production Clover");
  return { kind: "on", config: { environment, merchantId, token } };
}

// ---------------------------------------------------------------------------------------------
// What goes on the slip

export type TicketLine = { name: string; price: number };
export type Ticket = { title: string; note: string; lines: TicketLine[]; totalCents: number };

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const int = (v: unknown): number => (typeof v === "number" && Number.isSafeInteger(v) ? v : 0);
/** One line of plain text: no control characters or line breaks (they'd break Clover's printout). */
const flat = (v: unknown, max: number): string =>
  str(v)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

function fulfillmentLines(r: PrintRecord): string[] {
  const f = r.fulfillment;
  if (f?.method === "ship" && f.shipTo) {
    const a = f.shipTo;
    const where = [a.name, a.line1, a.line2, `${str(a.city)}, ${str(a.state)} ${str(a.zip)}`].map((x) => flat(x, 120)).filter((x) => x && x !== ",");
    return [`SHIP TO: ${where.join(", ")}`];
  }
  const label = flat(r.pickup?.label, 120) || flat(`${str(r.pickup?.date)} ${str(r.pickup?.start)}`, 120);
  return [`PICKUP: ${label || "time not set"}`];
}

function noteFor(r: PrintRecord, kind: string, extra: string[]): string {
  const ref = flat(r.payment?.providerOrderId, 64);
  const parts = [
    `PAID ONLINE at the website - do not charge again.`,
    `${kind} ${flat(r.number, 40)}${r.testMode ? " (TEST)" : ""}`,
    `Customer: ${flat(r.customer?.name, 100)}${r.customer?.phone ? `, ${flat(r.customer.phone, 30)}` : ""}`,
    ...fulfillmentLines(r),
    ...extra,
    ...(ref ? [`Clover web payment: ${ref}`] : []),
  ];
  return parts.filter(Boolean).join("\n").slice(0, NOTE_MAX);
}

/** What the Clover order says, worked out from the saved record only. */
export function ticketFor(collection: PrintCollection, doc: PrintRecord): Ticket {
  const lines: TicketLine[] = [];
  const extra: string[] = [];
  let shippingCents: number;
  let taxCents: number;
  let totalCents: number;
  if (collection === "orders") {
    const o = doc as Order;
    const raw = Array.isArray(o.lines) ? (o.lines as Record<string, unknown>[]) : [];
    for (const l of raw) {
      const qty = int(l.quantity) || 1;
      const option = flat(l.option, 60);
      const name = `${qty} x ${flat(l.title, 100)}${option ? ` (${option})` : ""}`;
      lines.push({ name: name.slice(0, NAME_MAX), price: Math.max(0, int(l.lineTotalCents) - int(l.discountCents)) });
    }
    shippingCents = int(o.totals?.shippingCents) || int(o.fulfillment?.shippingCents);
    taxCents = int(o.totals?.taxCents);
    totalCents = int(o.totals?.totalCents);
    if (int(o.totals?.discountCents) > 0) extra.push(`Reward discount ${formatCents(int(o.totals?.discountCents))} (already taken off the lines)`);
    if (o.notes) extra.push(`Customer note: ${flat(o.notes, 300)}`);
  } else {
    const r = doc as Reservation;
    const basket = (r.basket ?? {}) as { title?: unknown; components?: { name?: unknown; quantity?: unknown }[]; message?: unknown; requests?: unknown };
    shippingCents = int(r.fulfillment?.shippingCents);
    taxCents = int(r.taxCents);
    totalCents = int(r.totalCents);
    lines.push({ name: `1 x ${flat(basket.title, 100) || "Gift basket"}`.slice(0, NAME_MAX), price: Math.max(0, totalCents - taxCents - shippingCents) });
    const parts = (basket.components ?? []).map((c) => `${int(c.quantity) || 1} x ${flat(c.name, 60)}`);
    if (parts.length) extra.push(`Basket: ${parts.join("; ")}`.slice(0, 400));
    if (basket.message) extra.push(`Card message: ${flat(basket.message, 200)}`);
    if (basket.requests) extra.push(`Requests: ${flat(basket.requests, 200)}`);
    const paid = int(r.amountPaidCents);
    const due = int(r.balanceDueCents);
    extra.push(due > 0 ? `Paid online ${formatCents(paid)}. BALANCE DUE AT PICKUP ${formatCents(due)}` : `Paid in full online ${formatCents(paid || totalCents)}`);
  }
  if (shippingCents > 0) lines.push({ name: "Shipping (paid)", price: shippingCents });
  if (taxCents > 0) lines.push({ name: "Sales tax (paid)", price: taxCents });
  const kind = collection === "orders" ? "Web order" : "Basket reservation";
  return {
    title: `WEB ${flat(doc.number, 40)} PAID`.slice(0, TITLE_MAX),
    note: noteFor(doc, kind, extra),
    lines,
    totalCents: totalCents || lines.reduce((s, l) => s + l.price, 0),
  };
}

/** Whether this saved record should be on the device now. */
export function printDue(collection: PrintCollection, doc: PrintRecord, config: OrderPrintConfig, now: Date): boolean {
  const paid = collection === "orders" ? doc.paymentStatus === "paid" : doc.paymentStatus === "deposit_paid" || doc.paymentStatus === "paid_in_full";
  if (!paid) return false;
  const status = collection === "orders" ? (doc as Order).fulfillmentStatus : (doc as Reservation).reservationStatus;
  if (status === "canceled") return false;
  if (!doc.idempotencyKey) return false;
  // A sandbox (test) payment goes to the sandbox device only, a live one to the live device only.
  if (Boolean(doc.testMode) !== (config.environment === "sandbox")) return false;
  const created = Date.parse(doc.createdAt);
  return Number.isFinite(created) && now.getTime() - created <= PRINT_WINDOW_MS;
}

// ---------------------------------------------------------------------------------------------
// Clover calls

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ status: number; json(): Promise<unknown> }>;

export class CloverPrintError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CloverPrintError";
  }
  /** Bad token, missing permission, unknown merchant: retrying won't help until someone fixes it. */
  get permanent(): boolean {
    return this.status === 401 || this.status === 403 || this.status === 404;
  }
}

const ID = /^[A-Z0-9]{8,20}$/;

/** Clover's text with anything token-like removed, short. */
function clean(text: unknown): string {
  return str(text).replace(/(Bearer\s+)?[\w-]{24,}/g, "[redacted]").replace(/\s+/g, " ").trim().slice(0, 160);
}

export class CloverOrderPrinter {
  private readonly fetchImpl: FetchLike;
  constructor(
    private readonly config: OrderPrintConfig,
    opts: { fetch?: FetchLike } = {},
  ) {
    this.fetchImpl = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
  }

  private async call(method: "GET" | "POST", path: string, body?: unknown): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetchImpl(`${CLOVER_REST_HOSTS[this.config.environment]}/v3/merchants/${this.config.merchantId}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.config.token}`,
          accept: "application/json",
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
    } catch (e) {
      throw new CloverPrintError(`no answer from Clover (${clean((e as Error)?.message) || "network"})`, 0);
    } finally {
      clearTimeout(timer);
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status >= 200 && res.status < 300) return data;
    throw new CloverPrintError(`Clover answered ${res.status}${data.message ? `: ${clean(data.message)}` : ""}`, res.status);
  }

  /** An order this code already created (its answer was lost), found by its unique title. */
  async findOrderByTitle(title: string): Promise<string | null> {
    const data = await this.call("GET", `/orders?filter=${encodeURIComponent(`title=${title}`)}&limit=5`);
    const els = Array.isArray(data.elements) ? (data.elements as Record<string, unknown>[]) : [];
    const hit = els.find((e) => e.title === title && ID.test(str(e.id)));
    return hit ? str(hit.id) : null;
  }

  async createOrder(t: Ticket): Promise<string> {
    const data = await this.call("POST", "/orders", { state: "open", title: t.title, note: t.note, currency: "USD", total: t.totalCents, taxRemoved: true });
    const id = str(data.id);
    if (!ID.test(id)) throw new CloverPrintError("Clover created an order but gave no id we recognise", 200);
    return id;
  }

  async lineCount(orderId: string): Promise<number> {
    const data = await this.call("GET", `/orders/${orderId}/line_items?limit=100`);
    return Array.isArray(data.elements) ? data.elements.length : 0;
  }

  /** Custom lines: a name and a price only. Never `item`, so no inventory item is used or made. */
  async addLines(orderId: string, lines: TicketLine[]): Promise<void> {
    await this.call("POST", `/orders/${orderId}/bulk_line_items`, { items: lines.map((l) => ({ name: l.name, price: l.price })) });
  }

  async print(orderId: string): Promise<string> {
    const data = await this.call("POST", "/print_event", { orderRef: { id: orderId } });
    return str(data.id);
  }
}

// ---------------------------------------------------------------------------------------------
// Doing it once per record

/** Saved on the record's `sync-jobs` row after every step. */
export type PrintCheckpoint = {
  step: "creating" | "created" | "adding_lines" | "lines_added" | "printing" | "printed";
  cloverOrderId?: string;
  printEventId?: string;
  title?: string;
};

export type PrintOutcome =
  | { status: "off" | "not_due" | "already_printed" | "busy" | "gave_up" }
  | { status: "printed"; cloverOrderId: string; printEventId: string }
  | { status: "failed"; error: string };

export const printJobKey = (collection: PrintCollection, idempotencyKey: string) => `clover-print:${collection}:${idempotencyKey}`;

async function readRow(payload: Payload, key: string): Promise<{ attempts: number; checkpoint: PrintCheckpoint | null } | null> {
  const rows = await query(payload, "SELECT attempts, checkpoint FROM sync_jobs WHERE key = :key", { key });
  if (!rows.length) return null;
  let checkpoint: PrintCheckpoint | null = null;
  try {
    const raw = rows[0].checkpoint;
    checkpoint = typeof raw === "string" ? (JSON.parse(raw) as PrintCheckpoint) : ((raw as PrintCheckpoint | null) ?? null);
  } catch {
    checkpoint = null;
  }
  return { attempts: Number(rows[0].attempts ?? 0), checkpoint };
}

/** Takes the record's lock (one runner at a time) and counts an attempt. Null when busy, done or out of tries. */
async function claim(payload: Payload, key: string, now: Date): Promise<string | null> {
  const token = crypto.randomUUID();
  const stamp = iso(now);
  const results = await runBatch(payload, [
    { sql: "INSERT OR IGNORE INTO sync_jobs (key, status, attempts, updated_at, created_at) VALUES (:key, 'idle', 0, :now, :now)", args: { key, now: stamp } },
    {
      sql: `UPDATE sync_jobs SET status = 'running', lock_token = :token, locked_until = :until, attempts = COALESCE(attempts, 0) + 1, updated_at = :now
            WHERE key = :key AND last_success_at IS NULL AND COALESCE(attempts, 0) < :max AND (locked_until IS NULL OR locked_until <= :now)`,
      args: { key, token, until: iso(new Date(now.getTime() + LOCK_MS)), now: stamp, max: MAX_ATTEMPTS },
    },
  ]);
  return results[1].rowsAffected === 1 ? token : null;
}

async function save(payload: Payload, key: string, token: string, checkpoint: PrintCheckpoint): Promise<void> {
  const results = await runBatch(payload, [
    { sql: "UPDATE sync_jobs SET checkpoint = :cp, updated_at = :now WHERE key = :key AND lock_token = :token", args: { key, token, cp: JSON.stringify(checkpoint), now: iso(new Date()) } },
  ]);
  if (results[0].rowsAffected !== 1) throw new Error("lost the print lock");
}

async function finish(payload: Payload, key: string, token: string, outcome: { ok: true } | { ok: false; error: string; giveUp: boolean }): Promise<void> {
  const now = iso(new Date());
  await runBatch(payload, [
    {
      sql: `UPDATE sync_jobs SET status = :status, lock_token = NULL, locked_until = NULL,
              last_success_at = CASE WHEN :ok = 1 THEN :now ELSE last_success_at END,
              last_error = :error, attempts = CASE WHEN :giveUp = 1 THEN :max ELSE attempts END, updated_at = :now
            WHERE key = :key AND lock_token = :token`,
      args: { key, token, now, status: outcome.ok ? "idle" : "failed", ok: outcome.ok ? 1 : 0, error: outcome.ok ? null : outcome.error.slice(0, 500), giveUp: !outcome.ok && outcome.giveUp ? 1 : 0, max: MAX_ATTEMPTS },
    },
  ]);
}

export type PrintOptions = { env?: EnvLike; fetch?: FetchLike; now?: Date };

/**
 * Put this paid record on the Clover device, once. Safe to call after every save and from the retry
 * job; never throws and never changes the record.
 */
export async function printOrderToClover(payload: Payload, collection: PrintCollection, doc: PrintRecord, opts: PrintOptions = {}): Promise<PrintOutcome> {
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date();
  const label = `${collection === "orders" ? "order" : "reservation"} ${flat(doc?.number, 40)}`;
  let key = "";
  let token: string | null = null;
  try {
    const setting = orderPrintSettingFrom(env);
    if (setting.kind === "off") return { status: "off" };
    if (setting.kind === "misconfigured") {
      console.error(`[clover-print] ${label}: not printed, ${setting.reason}`);
      return { status: "failed", error: setting.reason };
    }
    if (!printDue(collection, doc, setting.config, now)) return { status: "not_due" };
    key = printJobKey(collection, doc.idempotencyKey);
    token = await claim(payload, key, now);
    if (!token) {
      const row = await readRow(payload, key);
      if (row?.checkpoint?.step === "printed") return { status: "already_printed" };
      if (row && row.attempts >= MAX_ATTEMPTS) return { status: "gave_up" };
      return { status: "busy" };
    }
    const printer = new CloverOrderPrinter(setting.config, { fetch: opts.fetch });
    const ticket = ticketFor(collection, doc);
    let cp: PrintCheckpoint = (await readRow(payload, key))?.checkpoint ?? { step: "creating" };
    if (cp.step === "printed" && cp.cloverOrderId) {
      // Printed, but the run stopped before it was marked done.
      await finish(payload, key, token, { ok: true });
      return { status: "already_printed" };
    }

    // 1. The order. If an earlier try sent the create but lost the answer, find that order first.
    if (!cp.cloverOrderId) {
      let found: string | null = null;
      if (cp.title) found = await printer.findOrderByTitle(cp.title);
      if (!found) {
        cp = { step: "creating", title: ticket.title };
        await save(payload, key, token, cp);
        found = await printer.createOrder(ticket);
      }
      cp = { ...cp, step: "created", cloverOrderId: found };
      await save(payload, key, token, cp);
    }
    const orderId = cp.cloverOrderId as string;

    // 2. Its lines, unless an earlier try already added them.
    if (cp.step === "created" || cp.step === "adding_lines") {
      const already = cp.step === "adding_lines" ? await printer.lineCount(orderId) : 0;
      if (already === 0) {
        cp = { ...cp, step: "adding_lines" };
        await save(payload, key, token, cp);
        await printer.addLines(orderId, ticket.lines);
      }
      cp = { ...cp, step: "lines_added" };
      await save(payload, key, token, cp);
    }

    // 3. The paper. A lost answer prints again (a second slip beats a missed order).
    cp = { ...cp, step: "printing" };
    await save(payload, key, token, cp);
    const printEventId = await printer.print(orderId);
    cp = { ...cp, step: "printed", printEventId };
    await save(payload, key, token, cp);
    await finish(payload, key, token, { ok: true });
    console.info(`[clover-print] ${label}: sent to the Clover device`);
    return { status: "printed", cloverOrderId: orderId, printEventId };
  } catch (e) {
    const message = e instanceof Error ? clean(e.message) || e.name : "unknown error";
    const giveUp = e instanceof CloverPrintError && e.permanent;
    console.error(`[clover-print] ${label}: not printed (${message})${giveUp ? "; check the token's permissions, not retrying" : "; will retry"}. The order itself is fine.`);
    if (token) await finish(payload, key, token, { ok: false, error: message, giveUp }).catch(() => undefined);
    return { status: "failed", error: message };
  }
}

/**
 * The retry: recent paid records that are not on the device yet. Run by the send-pending-emails job.
 * Does nothing (and reads nothing) while the switch is off.
 */
export async function printPendingOrders(payload: Payload, opts: PrintOptions = {}): Promise<{ checked: number; printed: number; failed: number }> {
  const report = { checked: 0, printed: 0, failed: 0 };
  const env = opts.env ?? process.env;
  if (orderPrintSettingFrom(env).kind !== "on") return report;
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - PRINT_WINDOW_MS).toISOString();
  const sets: [PrintCollection, string[]][] = [
    ["orders", ["paid"]],
    ["reservations", ["deposit_paid", "paid_in_full"]],
  ];
  for (const [collection, paid] of sets) {
    const { docs } = await payload.find({
      collection,
      where: { and: [{ paymentStatus: { in: paid } }, { createdAt: { greater_than_equal: since } }] },
      limit: 100,
      depth: 0,
      sort: "createdAt",
      overrideAccess: true,
    });
    for (const doc of docs) {
      const r = await printOrderToClover(payload, collection, doc as PrintRecord, { ...opts, env, now });
      if (r.status === "not_due" || r.status === "already_printed" || r.status === "gave_up" || r.status === "off") continue;
      report.checked++;
      if (r.status === "printed") report.printed++;
      if (r.status === "failed") report.failed++;
    }
  }
  return report;
}

/**
 * Printing paid web orders on the Clover device (D60), against a real Payload instance. No network:
 * Clover is a scripted `fetch`, and the hook test replaces the global `fetch`.
 *
 * Covers: one Clover order and one print per web order; nothing on re-save or a second run; a Clover
 * failure that leaves the paid order alone and is retried by the job; a create whose answer was lost
 * (found by title, not created twice); a bad token (given up, not retried); the switch off; and the
 * afterChange hook during a real checkout with Clover down.
 */
import type { Payload } from "payload";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { Order } from "@/payload-types";
import { placeOrder } from "@/src/lib/checkout/service";
import { newSubmission } from "@/src/lib/checkout/submission";
import { MAX_ATTEMPTS, printJobKey, printOrderToClover, printPendingOrders, type FetchLike } from "@/src/lib/clover/order-print";
import { query } from "@/src/lib/inventory/db";

import { bagWith, FORM, makeProduct, NOW, setupWorld, type World } from "./inventory-fixtures";

let w: World;
let payload: Payload;

const TOKEN = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const ENV = { APP_ENV: "test", CLOVER_ORDER_PRINT: "on", CLOVER_ORDER_PRINT_TOKEN: TOKEN, CLOVER_MERCHANT_ID: "MERCHANT0001", CLOVER_ORDER_PRINT_ENVIRONMENT: "sandbox" };

type Answer = { status: number; body: unknown } | "network-error";

function scripted(...answers: Answer[]) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ method: init.method, url, body: init.body ? JSON.parse(init.body) : undefined });
    const next = answers.shift();
    if (!next) throw new Error(`unexpected Clover call ${init.method} ${url}`);
    if (next === "network-error") throw new Error("socket hang up");
    return { status: next.status, json: async () => next.body };
  };
  return { fetch, calls, paths: () => calls.map((c) => `${c.method} ${c.url.replace(/^.*\/merchants\/MERCHANT0001/, "").replace(/\?.*$/, "")}`) };
}

const created = (id = "V3ORDER00001"): Answer => ({ status: 200, body: { id, state: "open" } });
const linesAdded: Answer = { status: 200, body: { elements: [{ id: "LINE00000001" }] } };
const printed = (id = "PRINTEVENT01"): Answer => ({ status: 200, body: { id, state: "CREATED" } });

let seq = 0;
async function paidOrder(): Promise<Order> {
  const product = await makeProduct(w, { title: `Print item ${++seq}`, stock: null, priceCents: 1000 });
  const token = await bagWith(w, product.id, 2);
  const result = await placeOrder(payload, { cartToken: token, form: FORM, submission: newSubmission("order"), now: NOW }, w.ctx);
  if (!result.ok) throw new Error(result.error);
  const { docs } = await payload.find({ collection: "orders", where: { number: { equals: result.number } }, overrideAccess: true });
  return docs[0] as Order;
}

async function row(order: Order) {
  const rows = await query(payload, "SELECT status, attempts, last_success_at, last_error, checkpoint FROM sync_jobs WHERE key = :key", { key: printJobKey("orders", order.idempotencyKey) });
  return rows[0];
}

beforeAll(async () => {
  w = await setupWorld();
  payload = w.payload;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("printing a paid web order on Clover (D60)", () => {
  it("creates one Clover order with custom lines, prints it once, and leaves the order as it was", async () => {
    const order = await paidOrder();
    expect(order.testMode).toBe(true); // the test provider counts as the sandbox
    const c = scripted(created(), linesAdded, printed());
    expect(await printOrderToClover(payload, "orders", order, { env: ENV, fetch: c.fetch })).toEqual({ status: "printed", cloverOrderId: "V3ORDER00001", printEventId: "PRINTEVENT01" });
    expect(c.paths()).toEqual(["POST /orders", "POST /orders/V3ORDER00001/bulk_line_items", "POST /print_event"]);
    expect(c.calls[0].body).toMatchObject({ state: "open", title: `WEB ${order.number} PAID`, total: order.totals.totalCents, taxRemoved: true });
    expect((c.calls[0].body as { note: string }).note).toContain(`Web order ${order.number} (TEST)`);
    const items = (c.calls[1].body as { items: Record<string, unknown>[] }).items;
    expect(items[0]).toEqual({ name: `2 x Print item ${seq}`, price: 2000 });
    for (const item of items) expect(Object.keys(item).sort()).toEqual(["name", "price"]);
    expect(items.reduce((s, i) => s + (i.price as number), 0)).toBe(order.totals.totalCents);

    const r = await row(order);
    expect(r).toMatchObject({ status: "idle", attempts: 1, last_error: null });
    expect(r.last_success_at).toBeTruthy();
    expect(JSON.parse(String(r.checkpoint))).toMatchObject({ step: "printed", cloverOrderId: "V3ORDER00001", printEventId: "PRINTEVENT01" });

    // Saving again, or the retry job, sends nothing.
    const none = scripted();
    expect(await printOrderToClover(payload, "orders", order, { env: ENV, fetch: none.fetch })).toEqual({ status: "already_printed" });
    await printPendingOrders(payload, { env: ENV, fetch: none.fetch });
    expect(none.calls).toHaveLength(0);
    const after = (await payload.findByID({ collection: "orders", id: order.id, overrideAccess: true })) as Order;
    expect(after.paymentStatus).toBe("paid");
    expect(after.updatedAt).toBe(order.updatedAt);
  });

  it("does nothing at all while the switch is off", async () => {
    const order = await paidOrder();
    const none = scripted();
    expect(await printOrderToClover(payload, "orders", order, { env: { APP_ENV: "test" }, fetch: none.fetch })).toEqual({ status: "off" });
    expect(await printPendingOrders(payload, { env: { APP_ENV: "test" }, fetch: none.fetch })).toEqual({ checked: 0, printed: 0, failed: 0 });
    expect(none.calls).toHaveLength(0);
    expect(await row(order)).toBeUndefined();
  });

  it("a Clover failure leaves the paid order alone, and the job finishes it from where it stopped", async () => {
    const order = await paidOrder();
    const first = scripted(created(), { status: 503, body: { message: "Service Unavailable" } });
    expect(await printOrderToClover(payload, "orders", order, { env: ENV, fetch: first.fetch })).toMatchObject({ status: "failed", error: expect.stringContaining("503") });
    expect(await row(order)).toMatchObject({ status: "failed", attempts: 1, last_success_at: null });

    // The retry checks whether the lines went in before adding them again, then prints.
    const retry = scripted({ status: 200, body: { elements: [] } }, linesAdded, printed());
    expect((await printOrderToClover(payload, "orders", order, { env: ENV, fetch: retry.fetch })).status).toBe("printed");
    expect(retry.paths()).toEqual(["GET /orders/V3ORDER00001/line_items", "POST /orders/V3ORDER00001/bulk_line_items", "POST /print_event"]);
    expect(await row(order)).toMatchObject({ status: "idle", attempts: 2, last_error: null });
    expect(((await payload.findByID({ collection: "orders", id: order.id, overrideAccess: true })) as Order).paymentStatus).toBe("paid");
  });

  it("never creates a second Clover order when the first create's answer was lost", async () => {
    const order = await paidOrder();
    const lost = scripted("network-error");
    expect((await printOrderToClover(payload, "orders", order, { env: ENV, fetch: lost.fetch })).status).toBe("failed");

    const title = `WEB ${order.number} PAID`;
    const retry = scripted({ status: 200, body: { elements: [{ id: "V3ORDERLOST1", title }] } }, linesAdded, printed());
    expect(await printOrderToClover(payload, "orders", order, { env: ENV, fetch: retry.fetch })).toMatchObject({ status: "printed", cloverOrderId: "V3ORDERLOST1" });
    expect(retry.paths()).toEqual(["GET /orders", "POST /orders/V3ORDERLOST1/bulk_line_items", "POST /print_event"]);
    expect(retry.calls.some((c) => c.method === "POST" && c.url.endsWith("/orders"))).toBe(false);
  });

  it("stops retrying when the token is refused (missing permission), and never retries past the cap", async () => {
    const order = await paidOrder();
    const refused = scripted({ status: 401, body: { message: "401 Unauthorized" } });
    expect(await printOrderToClover(payload, "orders", order, { env: ENV, fetch: refused.fetch })).toMatchObject({ status: "failed" });
    expect(await row(order)).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS });
    const none = scripted();
    expect(await printOrderToClover(payload, "orders", order, { env: ENV, fetch: none.fetch })).toEqual({ status: "gave_up" });
    expect(none.calls).toHaveLength(0);
  });

  it("the send-pending-emails job prints recent paid orders that aren't on the device yet, and only those", async () => {
    const order = await paidOrder();
    const answers: Answer[] = [];
    for (let i = 0; i < 20; i++) answers.push(created(`V3JOB${String(i).padStart(7, "0")}`), linesAdded, printed());
    const job = scripted(...answers);
    const report = await printPendingOrders(payload, { env: ENV, fetch: job.fetch });
    expect(report.failed).toBe(0);
    expect(report.printed).toBeGreaterThanOrEqual(1);
    expect(await row(order)).toMatchObject({ status: "idle" });
    const again = scripted();
    expect(await printPendingOrders(payload, { env: ENV, fetch: again.fetch })).toEqual({ checked: 0, printed: 0, failed: 0 });
    expect(again.calls).toHaveLength(0);
  });

  it("does not print a test order to the live device", async () => {
    const order = await paidOrder();
    const none = scripted();
    expect(await printOrderToClover(payload, "orders", order, { env: { ...ENV, CLOVER_ORDER_PRINT_ENVIRONMENT: "production" }, fetch: none.fetch })).toEqual({ status: "not_due" });
    expect(none.calls).toHaveLength(0);
  });

  it("runs from the afterChange hook at checkout, and Clover being down never fails the customer's order", async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    const down = vi.fn(async (url: string): Promise<never> => {
      throw new Error(`connect ECONNREFUSED (${url.length})`);
    });
    vi.stubGlobal("fetch", down);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const order = await paidOrder();
      expect(order.paymentStatus).toBe("paid");
      expect(down).toHaveBeenCalled();
      expect(String(down.mock.calls[0]?.[0] ?? "")).toContain("apisandbox.dev.clover.com/v3/merchants/MERCHANT0001/orders");
      expect(await row(order)).toMatchObject({ status: "failed", attempts: 1 });
      const logged = errors.mock.calls.map((c) => String(c[0])).join("\n");
      expect(logged).toContain("[clover-print]");
      expect(logged).toContain("The order itself is fine.");
      expect(logged).not.toContain(TOKEN);
    } finally {
      errors.mockRestore();
    }
  });
});

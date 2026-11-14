/**
 * Printing paid web orders on the Clover device (D60): settings, what goes on the slip, when it is
 * due, and the exact Clover requests. No network: Clover is a scripted `fetch`.
 */
import { describe, expect, it } from "vitest";

import type { Order, Reservation } from "@/payload-types";

import { CloverOrderPrinter, CloverPrintError, orderPrintSettingFrom, PRINT_WINDOW_MS, printDue, ticketFor, type OrderPrintConfig } from "./order-print";

const TOKEN = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const MID = "MERCHANT0001";
const ON = { CLOVER_ORDER_PRINT: "on", CLOVER_ORDER_PRINT_TOKEN: TOKEN, CLOVER_MERCHANT_ID: MID, CLOVER_ECOMM_ENVIRONMENT: "sandbox", APP_ENV: "staging" };
const SANDBOX: OrderPrintConfig = { environment: "sandbox", merchantId: MID, token: TOKEN };
const LIVE: OrderPrintConfig = { ...SANDBOX, environment: "production" };
const NOW = new Date("2026-11-13T15:00:00Z");

function order(over: Partial<Order> = {}): Order {
  return {
    id: 1,
    number: "SP-1042",
    accessTokenHash: "x",
    idempotencyKey: "key-1042",
    testMode: true,
    fulfillmentStatus: "preparing",
    paymentStatus: "paid",
    customer: { name: "Pat Customer", email: "pat@example.test", phone: "(508) 555-0100" },
    fulfillment: { method: "pickup", shippingCents: 0 },
    pickup: { date: "2026-11-14", start: "11:00", end: "11:30", label: "Sat Nov 14, 11:00–11:30 AM" },
    notes: "No nuts\nplease",
    lines: [
      { title: "Fudge box", option: "Dark", quantity: 2, unitPriceCents: 1200, lineTotalCents: 2400, discountCents: 300, taxCents: 131 },
      { title: "Gummy bears", option: null, quantity: 1, unitPriceCents: 500, lineTotalCents: 500, discountCents: 200, taxCents: 19 },
    ],
    totals: { subtotalCents: 2900, discountCents: 500, taxCents: 150, shippingCents: 0, totalCents: 2550, taxApproved: true },
    payment: { provider: "clover", reference: "CHG1", providerOrderId: "ECOMORDER123" },
    createdAt: "2026-11-13T14:00:00Z",
    updatedAt: "2026-11-13T14:00:00Z",
    ...over,
  } as Order;
}

function reservation(over: Partial<Reservation> = {}): Reservation {
  return {
    id: 2,
    number: "SR-2001",
    accessTokenHash: "x",
    idempotencyKey: "key-2001",
    testMode: true,
    reservationStatus: "confirmed",
    paymentStatus: "deposit_paid",
    customer: { name: "Ann Buyer", email: "ann@example.test", phone: "(508) 555-0199" },
    fulfillment: { method: "pickup", shippingCents: 0 },
    pickup: { date: "2026-11-20", start: "10:00", end: "10:30", label: "Fri Nov 20, 10:00 AM" },
    amountPaidCents: 5000,
    balanceDueCents: 6300,
    basket: { title: "Build a Basket (Large)", components: [{ name: "Truffles", quantity: 3 }], message: "Happy birthday", requests: "" },
    totalCents: 11300,
    taxCents: 300,
    depositCents: 5000,
    createdAt: "2026-11-13T14:00:00Z",
    updatedAt: "2026-11-13T14:00:00Z",
    ...over,
  } as Reservation;
}

describe("orderPrintSettingFrom", () => {
  it("is off unless CLOVER_ORDER_PRINT=on", () => {
    expect(orderPrintSettingFrom({})).toEqual({ kind: "off" });
    expect(orderPrintSettingFrom({ ...ON, CLOVER_ORDER_PRINT: "" })).toEqual({ kind: "off" });
    expect(orderPrintSettingFrom({ ...ON, CLOVER_ORDER_PRINT: "off" })).toEqual({ kind: "off" });
  });

  it("reads the token, merchant and environment, with the D43/D54 variables as fallbacks", () => {
    expect(orderPrintSettingFrom(ON)).toEqual({ kind: "on", config: SANDBOX });
    const fallback = orderPrintSettingFrom({ CLOVER_ORDER_PRINT: "on", CLOVER_API_TOKEN: TOKEN, CLOVER_ECOMM_MERCHANT_ID: MID, CLOVER_ORDER_PRINT_ENVIRONMENT: "production" });
    expect(fallback).toEqual({ kind: "on", config: LIVE });
  });

  it("names what is missing and never echoes a value", () => {
    for (const [env, word] of [
      [{ ...ON, CLOVER_ORDER_PRINT_TOKEN: "" }, "CLOVER_ORDER_PRINT_TOKEN"],
      [{ ...ON, CLOVER_MERCHANT_ID: "" }, "CLOVER_MERCHANT_ID"],
      [{ ...ON, CLOVER_ECOMM_ENVIRONMENT: "prod" }, "sandbox"],
      [{ ...ON, CLOVER_ORDER_PRINT_TOKEN: "short" }, "does not look like"],
      [{ ...ON, CLOVER_MERCHANT_ID: "lower-case-id" }, "does not look like"],
    ] as const) {
      const s = orderPrintSettingFrom(env);
      expect(s.kind).toBe("misconfigured");
      if (s.kind !== "misconfigured") continue;
      expect(s.reason).toContain(word);
      expect(s.reason).not.toContain(TOKEN);
    }
  });

  it("refuses the sandbox on the live store (unset APP_ENV counts as live)", () => {
    const live = { ...ON, APP_ENV: undefined };
    expect(orderPrintSettingFrom(live)).toMatchObject({ kind: "misconfigured", reason: expect.stringContaining("production") });
    expect(orderPrintSettingFrom({ ...live, CLOVER_ECOMM_ENVIRONMENT: "production" })).toEqual({ kind: "on", config: LIVE });
  });
});

describe("ticketFor", () => {
  it("prints a shop order as custom lines that add up to what was charged", () => {
    const t = ticketFor("orders", order());
    expect(t.title).toBe("WEB SP-1042 PAID");
    expect(t.lines).toEqual([
      { name: "2 x Fudge box (Dark)", price: 2100 },
      { name: "1 x Gummy bears", price: 300 },
      { name: "Sales tax (paid)", price: 150 },
    ]);
    expect(t.lines.reduce((s, l) => s + l.price, 0)).toBe(2550);
    expect(t.totalCents).toBe(2550);
    expect(t.note.split("\n")).toEqual([
      "PAID ONLINE at the website - do not charge again.",
      "Web order SP-1042 (TEST)",
      "Customer: Pat Customer, (508) 555-0100",
      "PICKUP: Sat Nov 14, 11:00–11:30 AM",
      "Reward discount $5.00 (already taken off the lines)",
      "Customer note: No nuts please",
      "Clover web payment: ECOMORDER123",
    ]);
  });

  it("shows shipping as a line and the ship-to address instead of a pickup", () => {
    const t = ticketFor(
      "orders",
      order({
        testMode: false,
        notes: "",
        totals: { subtotalCents: 2900, discountCents: 0, taxCents: 0, shippingCents: 895, totalCents: 3795 },
        lines: [{ title: "Fudge box", quantity: 1, lineTotalCents: 2900 }],
        fulfillment: { method: "ship", shippingCents: 895, shipTo: { name: "Pat", line1: "1 Main St", line2: "", city: "Attleboro", state: "MA", zip: "02703" } },
      }),
    );
    expect(t.lines).toEqual([
      { name: "1 x Fudge box", price: 2900 },
      { name: "Shipping (paid)", price: 895 },
    ]);
    expect(t.note).toContain("SHIP TO: Pat, 1 Main St, Attleboro, MA 02703");
    expect(t.note).not.toContain("PICKUP");
    expect(t.note).not.toContain("(TEST)");
  });

  it("prints a basket reservation with the balance still due at pickup", () => {
    const t = ticketFor("reservations", reservation());
    expect(t.title).toBe("WEB SR-2001 PAID");
    expect(t.lines).toEqual([
      { name: "1 x Build a Basket (Large)", price: 11000 },
      { name: "Sales tax (paid)", price: 300 },
    ]);
    expect(t.note).toContain("Basket reservation SR-2001");
    expect(t.note).toContain("Basket: 3 x Truffles");
    expect(t.note).toContain("Card message: Happy birthday");
    expect(t.note).toContain("Paid online $50.00. BALANCE DUE AT PICKUP $63.00");
    expect(ticketFor("reservations", reservation({ paymentStatus: "paid_in_full", amountPaidCents: 11300, balanceDueCents: 0 })).note).toContain("Paid in full online $113.00");
  });

  it("keeps customer text to one line and inside Clover's limits", () => {
    const t = ticketFor("orders", order({ customer: { name: "Eve\u0007\r\nInjected", email: "e@x.test", phone: "1" }, lines: [{ title: "x".repeat(400), quantity: 1, lineTotalCents: 100 }] }));
    expect(t.note).toContain("Customer: Eve Injected, 1");
    expect(t.lines[0].name.length).toBeLessThanOrEqual(127);
    expect(t.note.length).toBeLessThanOrEqual(1000);
  });
});

describe("printDue", () => {
  it("prints paid records only, not canceled ones", () => {
    expect(printDue("orders", order(), SANDBOX, NOW)).toBe(true);
    for (const paymentStatus of ["pending", "failed", "unknown", "refunded"] as const) expect(printDue("orders", order({ paymentStatus }), SANDBOX, NOW)).toBe(false);
    expect(printDue("orders", order({ fulfillmentStatus: "canceled" }), SANDBOX, NOW)).toBe(false);
    expect(printDue("reservations", reservation(), SANDBOX, NOW)).toBe(true);
    expect(printDue("reservations", reservation({ paymentStatus: "paid_in_full" }), SANDBOX, NOW)).toBe(true);
    expect(printDue("reservations", reservation({ paymentStatus: "deposit_pending" }), SANDBOX, NOW)).toBe(false);
  });

  it("sends a test payment only to the sandbox and a live one only to the live device", () => {
    expect(printDue("orders", order({ testMode: true }), LIVE, NOW)).toBe(false);
    expect(printDue("orders", order({ testMode: false }), SANDBOX, NOW)).toBe(false);
    expect(printDue("orders", order({ testMode: false }), LIVE, NOW)).toBe(true);
  });

  it("never prints records older than the window (switching it on doesn't print the backlog)", () => {
    const old = new Date(NOW.getTime() - PRINT_WINDOW_MS - 60_000).toISOString();
    expect(printDue("orders", order({ createdAt: old }), SANDBOX, NOW)).toBe(false);
  });
});

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

function scripted(...answers: ({ status: number; body: unknown } | "network-error")[]) {
  const calls: Call[] = [];
  const fetch = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    const next = answers.shift();
    if (!next) throw new Error(`unexpected Clover call ${init.method} ${url}`);
    if (next === "network-error") throw new Error("socket hang up");
    return { status: next.status, json: async () => next.body };
  };
  return { fetch, calls };
}

describe("CloverOrderPrinter", () => {
  it("creates an open, tax-removed order, adds name-and-price lines and prints it", async () => {
    const { fetch, calls } = scripted({ status: 200, body: { id: "V3ORDER00001" } }, { status: 200, body: { elements: [] } }, { status: 200, body: { id: "PRINTEVENT01", state: "CREATED" } });
    const p = new CloverOrderPrinter(SANDBOX, { fetch });
    const t = ticketFor("orders", order());
    expect(await p.createOrder(t)).toBe("V3ORDER00001");
    await p.addLines("V3ORDER00001", t.lines);
    expect(await p.print("V3ORDER00001")).toBe("PRINTEVENT01");

    const base = `https://apisandbox.dev.clover.com/v3/merchants/${MID}`;
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([`POST ${base}/orders`, `POST ${base}/orders/V3ORDER00001/bulk_line_items`, `POST ${base}/print_event`]);
    expect(calls[0].body).toEqual({ state: "open", title: "WEB SP-1042 PAID", note: t.note, currency: "USD", total: 2550, taxRemoved: true });
    expect(calls[1].body).toEqual({ items: t.lines.map((l) => ({ name: l.name, price: l.price })) });
    expect(JSON.stringify(calls[1].body)).not.toContain('"item"');
    expect(calls[2].body).toEqual({ orderRef: { id: "V3ORDER00001" } });
    for (const c of calls) {
      expect(c.headers.authorization).toBe(`Bearer ${TOKEN}`);
      expect(c.url).not.toContain(TOKEN);
      expect(JSON.stringify(c.body)).not.toContain(TOKEN);
    }
  });

  it("uses api.clover.com for production", async () => {
    const { fetch, calls } = scripted({ status: 200, body: { id: "PRINTEVENT01" } });
    await new CloverOrderPrinter(LIVE, { fetch }).print("V3ORDER00001");
    expect(calls[0].url).toBe(`https://api.clover.com/v3/merchants/${MID}/print_event`);
  });

  it("finds an order by its exact title (for a create whose answer was lost)", async () => {
    const { fetch, calls } = scripted({ status: 200, body: { elements: [{ id: "OTHER0000001", title: "WEB SP-10420 PAID" }, { id: "V3ORDER00001", title: "WEB SP-1042 PAID" }] } });
    expect(await new CloverOrderPrinter(SANDBOX, { fetch }).findOrderByTitle("WEB SP-1042 PAID")).toBe("V3ORDER00001");
    expect(calls[0].method).toBe("GET");
    expect(decodeURIComponent(calls[0].url)).toContain("/orders?filter=title=WEB SP-1042 PAID");
  });

  it("turns errors into CloverPrintError with the token redacted; 401/403 are permanent", async () => {
    const { fetch } = scripted({ status: 401, body: { message: `Unauthorized ${TOKEN}` } }, { status: 500, body: {} }, "network-error");
    const p = new CloverOrderPrinter(SANDBOX, { fetch });
    const e1 = (await p.print("V3ORDER00001").catch((e) => e)) as CloverPrintError;
    expect(e1).toBeInstanceOf(CloverPrintError);
    expect(e1.permanent).toBe(true);
    expect(e1.message).not.toContain(TOKEN);
    const e2 = (await p.print("V3ORDER00001").catch((e) => e)) as CloverPrintError;
    expect(e2.permanent).toBe(false);
    const e3 = (await p.print("V3ORDER00001").catch((e) => e)) as CloverPrintError;
    expect(e3.status).toBe(0);
    expect(e3.permanent).toBe(false);
  });

  it("refuses an order id it doesn't recognise", async () => {
    const { fetch } = scripted({ status: 200, body: { id: "../../x" } });
    await expect(new CloverOrderPrinter(SANDBOX, { fetch }).createOrder(ticketFor("orders", order()))).rejects.toThrow("no id");
  });
});

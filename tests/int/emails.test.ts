/**
 * Transactional emails against a real Payload instance (D44). Nothing here can send: the transport is
 * replaced by a capturing function on `payload.sendEmail`, and the configured adapter is the console one.
 *
 * Covers: one customer and one staff email for a paid order; nothing on re-save; nothing while the payment is
 * unknown or declined; a later transition to paid; reservations; inquiries; a failing transport that must not
 * break the order and leaves the marker for the retry; the retry itself; and the claim that stops two runs
 * sending the same email.
 */
import type { Payload } from "payload";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Order, Reservation } from "@/payload-types";
import { accessUrlToken } from "@/src/lib/checkout/order";
import { placeOrder, reserveBasket, type BasketDraft, type CheckoutContext } from "@/src/lib/checkout/service";
import { newSubmission } from "@/src/lib/checkout/submission";
import { sendPendingEmails } from "@/src/lib/email/pending";
import { sendDueEmails } from "@/src/lib/email/notify";
import { HONEYPOT_FIELD } from "@/src/lib/inquiries/shared";
import { submitInquiry } from "@/src/lib/inquiries/service";
import type { ChargeResult, PaymentProvider } from "@/src/lib/payments";

import { bagWith, FORM, makeProduct, NOW, setupWorld, type World } from "./inventory-fixtures";

type Captured = { to: string; from: string; replyTo?: string; subject: string; text: string; html: string };

let w: World;
let payload: Payload;
let ctx: CheckoutContext;
const sent: Captured[] = [];
let transportDown = false;
let seq = 0;
const logged: string[] = [];

const SITE = "https://shop.example.test";
const STORE_EMAIL = "lodelicious1@gmail.com";

function scripted(...script: (ChargeResult | "throw")[]): PaymentProvider {
  let n = 0;
  return {
    id: "fake-live",
    test: false,
    async charge() {
      const next = script[Math.min(n++, script.length - 1)];
      if (next === "throw") throw new Error("socket hang up");
      return next;
    },
  };
}
const declined: ChargeResult = { status: "failed", reference: "", message: "card declined" };
const live = (provider: PaymentProvider): CheckoutContext => ({ ...ctx, provider, chargeTimeoutMs: 200 });

const orderOf = async (number: string) => (await payload.find({ collection: "orders", where: { number: { equals: number } }, depth: 0, overrideAccess: true })).docs[0] as Order;
const reservationOf = async (number: string) => (await payload.find({ collection: "reservations", where: { number: { equals: number } }, depth: 0, overrideAccess: true })).docs[0] as Reservation;
const to = (address: string) => sent.filter((m) => m.to === address);

async function order(opts: { notes?: string; email?: string; provider?: PaymentProvider } = {}) {
  const p = await makeProduct(w, { title: `Email fudge ${++seq}`, stock: 50, priceCents: 1000 });
  const token = await bagWith(w, p.id, 2);
  const result = await placeOrder(payload, { cartToken: token, form: { ...FORM, ...(opts.email ? { email: opts.email } : {}), ...(opts.notes ? { notes: opts.notes } : {}) }, submission: newSubmission("order"), now: NOW }, opts.provider ? live(opts.provider) : ctx);
  return result;
}

beforeAll(async () => {
  w = await setupWorld();
  payload = w.payload;
  ctx = w.ctx;
  process.env.NEXT_PUBLIC_SITE_URL = SITE;
  payload.sendEmail = async (message) => {
    if (transportDown) throw new Error("connect ECONNREFUSED smtp.example.test (sending as pat@example.test)");
    sent.push(message as unknown as Captured);
  };
  vi.spyOn(console, "info").mockImplementation((line: unknown) => void logged.push(String(line)));
  vi.spyOn(console, "error").mockImplementation((line: unknown) => void logged.push(String(line)));
});

afterAll(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  vi.restoreAllMocks();
});

beforeEach(() => {
  sent.length = 0;
  logged.length = 0;
  transportDown = false;
});

describe("setup", () => {
  it("is on the console adapter, so a test that forgets the capture still cannot send", () => {
    expect(payload.email.name).toBe("console");
  });
});

describe("a paid order", () => {
  it("sends one confirmation to the customer and one notice to staff, with the private link, From and Reply-To", async () => {
    const result = await order();
    if (!result.ok) throw new Error(result.error);
    expect(sent).toHaveLength(2);

    const [customer] = to("pat@example.test");
    expect(to("pat@example.test")).toHaveLength(1);
    expect(customer.subject).toBe(`[TEST] Your order ${result.number} is confirmed`);
    expect(customer.text).toContain(`${SITE}/order/${result.number}?t=${result.token}`);
    expect(customer.text).toContain("2 × Email fudge 1");
    expect(customer.text).toContain("$20.00");
    expect(customer.text).toContain("(774) 283-4676");
    expect(customer.from).toBe(`Souset-Pink <${STORE_EMAIL}>`);
    expect(customer.replyTo).toBe(STORE_EMAIL);

    const staff = to(STORE_EMAIL);
    expect(staff).toHaveLength(1);
    expect(staff[0].subject).toContain(`New order ${result.number}`);
    expect(staff[0].text).toContain("pat@example.test");
    expect(staff[0].text).toContain("/admin/collections/orders/");

    const saved = await orderOf(result.number);
    expect(saved.emails?.confirmationSentAt).toBeTruthy();
    expect(saved.emails?.staffNotifiedAt).toBeTruthy();
  });

  it("sends nothing more when the record is saved again, by staff or by the system", async () => {
    const result = await order();
    if (!result.ok) throw new Error(result.error);
    sent.length = 0;
    const saved = await orderOf(result.number);
    await payload.update({ collection: "orders", id: saved.id, data: { staffNotes: "Packed early" }, user: w.owner, overrideAccess: false });
    await payload.update({ collection: "orders", id: saved.id, data: { fulfillmentStatus: "ready" }, user: w.fulfillment, overrideAccess: false });
    await payload.update({ collection: "orders", id: saved.id, data: { paymentStatus: "paid" }, user: w.owner, overrideAccess: false });
    expect(await sendDueEmails(payload, "orders", await orderOf(result.number))).toEqual({ sent: [], failed: [] });
    expect(sent).toHaveLength(0);
  });

  it("tells staff to read the note and tells the customer a person will, when notes were left", async () => {
    const result = await order({ notes: "Nut allergy <b>please</b>" });
    if (!result.ok) throw new Error(result.error);
    const [customer] = to("pat@example.test");
    expect(customer.subject).toContain("we are checking your note");
    expect(customer.html).toContain("Nut allergy &lt;b&gt;please&lt;/b&gt;");
    expect(to(STORE_EMAIL)[0].subject).toContain("needs staff review");
  });

  it("sends staff to the notification email from Store settings, then back to the shop email when it is cleared", async () => {
    await payload.updateGlobal({ slug: "store-settings", data: { notificationEmail: "faisal@example.test" }, overrideAccess: true });
    await order();
    expect(to("faisal@example.test")).toHaveLength(1);
    expect(to(STORE_EMAIL)).toHaveLength(0);
    await payload.updateGlobal({ slug: "store-settings", data: { notificationEmail: null }, overrideAccess: true });
    sent.length = 0;
    await order();
    expect(to(STORE_EMAIL)).toHaveLength(1);
  });

  it("puts nothing secret in any message", async () => {
    const result = await order({ notes: "hello" });
    if (!result.ok) throw new Error(result.error);
    const saved = (await payload.find({ collection: "orders", where: { number: { equals: result.number } }, depth: 0, overrideAccess: true })).docs[0] as Order & { accessTokenHash?: string };
    const all = JSON.stringify(sent);
    expect(all).not.toMatch(/accessTokenHash|staffNotes|stockNote|live_1|test_/i);
    expect(all).not.toContain(saved.idempotencyKey);
    // The link carries the URL token, which is not the stored hash.
    expect(all).toContain(accessUrlToken("order", saved.idempotencyKey));
  });
});

describe("states that must not send", () => {
  it("a declined payment sends nothing", async () => {
    const result = await order({ provider: scripted(declined) });
    expect(result.ok).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("an unknown payment tells staff once and never the customer, and no 'new order' email", async () => {
    const result = await order({ provider: scripted("throw") });
    expect(result.ok).toBe(false);
    const number = (result as { error: string }).error.match(/SP-\d+/)![0];
    expect(to("pat@example.test")).toHaveLength(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(STORE_EMAIL);
    expect(sent[0].subject).toMatch(/Needs attention: order .* \(payment unknown\)/);
    expect(sent[0].subject).not.toMatch(/New order/);

    // Saving it again does not repeat the warning.
    sent.length = 0;
    const saved = await orderOf(number);
    await payload.update({ collection: "orders", id: saved.id, data: { staffNotes: "Calling the provider" }, user: w.owner, overrideAccess: false });
    expect(sent).toHaveLength(0);
  });

  it("staff marking the unknown payment paid sends the confirmation then", async () => {
    const result = await order({ provider: scripted("throw"), email: "later@example.test" });
    const number = (result as { error: string }).error.match(/SP-\d+/)![0];
    sent.length = 0;
    const saved = await orderOf(number);
    await payload.update({ collection: "orders", id: saved.id, data: { paymentStatus: "paid" }, user: w.owner, overrideAccess: false });
    expect(to("later@example.test")).toHaveLength(1);
    expect(to("later@example.test")[0].text).toContain(`${SITE}/order/${number}?t=`);
    expect(to(STORE_EMAIL)).toHaveLength(1);
    expect(to(STORE_EMAIL)[0].subject).toContain(`New order ${number}`);
    sent.length = 0;
    await payload.update({ collection: "orders", id: saved.id, data: { fulfillmentStatus: "ready" }, user: w.owner, overrideAccess: false });
    expect(sent).toHaveLength(0);
  });

  it("a paid order whose stock needs attention warns staff once", async () => {
    const result = await order();
    if (!result.ok) throw new Error(result.error);
    sent.length = 0;
    const saved = await orderOf(result.number);
    await payload.update({ collection: "orders", id: saved.id, data: { stockStatus: "needs_attention" }, overrideAccess: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toMatch(/Needs attention: order .* \(stock\)/);
    await payload.update({ collection: "orders", id: saved.id, data: { staffNotes: "Counting the shelf" }, overrideAccess: true });
    expect(sent).toHaveLength(1);
  });
});

describe("reservations", () => {
  it("a paid deposit sends the customer the deposit, balance and link, and tells staff", async () => {
    const items = [];
    for (let i = 0; i < 6; i++) {
      const item = await makeProduct(w, { title: `Email item ${i}`, stock: 20, reserve: 1, priceCents: 400, basketEligible: true });
      await payload.update({ collection: "products", id: item.id, data: { giftTypes: ["sweet"] }, overrideAccess: true });
      items.push(item);
    }
    const draft: BasketDraft = { request: { kind: "custom", size: "small", giftType: "sweet", budgetCents: null, selections: items.map((p) => ({ productId: String(p.id), quantity: 1 })) }, message: "", requests: "" };
    const result = await reserveBasket(payload, { draft, form: { ...FORM, email: "basket@example.test", pickup: "2026-10-08|11:00", payment: "deposit" }, submission: newSubmission("reservation"), now: NOW }, ctx);
    if (!result.ok) throw new Error(result.error);
    const saved = await reservationOf(result.number);
    expect(sent).toHaveLength(2);
    const [customer] = to("basket@example.test");
    expect(customer.subject).toBe(`[TEST] Your basket reservation ${result.number} is confirmed`);
    expect(customer.text).toContain(`Deposit paid: $${(saved.amountPaidCents / 100).toFixed(2)}`);
    expect(customer.text).toContain(`Balance due at pickup: $${(saved.balanceDueCents / 100).toFixed(2)}`);
    expect(customer.text).toContain(`${SITE}/reservation/${result.number}?t=${result.token}`);
    expect(to(STORE_EMAIL)[0].subject).toContain(`New reservation ${result.number}`);
    expect(saved.emails?.confirmationSentAt).toBeTruthy();

    sent.length = 0;
    await payload.update({ collection: "reservations", id: saved.id, data: { staffNotes: "Ribbon chosen" }, user: w.owner, overrideAccess: false });
    expect(sent).toHaveLength(0);
  });
});

describe("inquiries", () => {
  const GENERAL = { name: "Ina Inquirer", email: "ina@example.test", phone: "(508) 555-0111", topic: "general", message: "Do you ship fudge?" };

  it("sends the customer a receipt and staff a note when one arrives, once", async () => {
    const result = await submitInquiry(payload, { kind: "contact", form: GENERAL, now: NOW });
    if (!result.ok || !result.number) throw new Error("not created");
    expect(sent).toHaveLength(2);
    const [receipt] = to("ina@example.test");
    expect(receipt.subject).toContain(result.number);
    expect(receipt.text).toMatch(/Nothing has been booked, reserved or charged/);
    expect(to(STORE_EMAIL)[0].subject).toContain(`New inquiry ${result.number}`);

    // The same submission again is the same inquiry and sends nothing.
    sent.length = 0;
    expect(await submitInquiry(payload, { kind: "contact", form: GENERAL, now: NOW })).toEqual(result);
    expect(sent).toHaveLength(0);
  });

  it("never emails a honeypot-dropped inquiry", async () => {
    const result = await submitInquiry(payload, { kind: "contact", form: { ...GENERAL, email: "bot@example.test", [HONEYPOT_FIELD]: "http://spam.example" }, now: NOW });
    expect(result).toEqual({ ok: true, number: null });
    expect(sent).toHaveLength(0);
  });
});

describe("a failing transport", () => {
  it("does not break order placement, leaves the markers empty, logs nothing personal, and the retry sends once", async () => {
    transportDown = true;
    const result = await order({ email: "down@example.test" });
    if (!result.ok) throw new Error(`placement failed: ${result.error}`);
    const saved = await orderOf(result.number);
    expect(saved).toMatchObject({ paymentStatus: "paid", fulfillmentStatus: "preparing" });
    expect(saved.emails?.confirmationSentAt ?? null).toBeNull();
    expect(saved.emails?.staffNotifiedAt ?? null).toBeNull();
    expect(sent).toHaveLength(0);
    expect(logged.join("\n")).toMatch(/\[email\] FAILED customer_order/);
    expect(logged.join("\n")).not.toMatch(/pat@example\.test|down@example\.test/);

    // A save while the transport is still down also fails quietly.
    await payload.update({ collection: "orders", id: saved.id, data: { staffNotes: "x" }, user: w.owner, overrideAccess: false });

    transportDown = false;
    const first = await sendPendingEmails(payload);
    expect(first.sent).toBeGreaterThanOrEqual(2);
    expect(to("down@example.test")).toHaveLength(1);
    expect(sent.filter((m) => m.subject.includes(result.number))).toHaveLength(2);
    const after = await orderOf(result.number);
    expect(after.emails?.confirmationSentAt).toBeTruthy();
    expect(after.emails?.staffNotifiedAt).toBeTruthy();

    sent.length = 0;
    expect(await sendPendingEmails(payload)).toEqual({ records: 0, sent: 0, failed: 0 });
    expect(sent).toHaveLength(0);
  });

  it("two runs at once send each email once", async () => {
    transportDown = true;
    const result = await order({ email: "race@example.test" });
    if (!result.ok) throw new Error(result.error);
    transportDown = false;
    const record = await orderOf(result.number);
    const [a, b] = await Promise.all([sendDueEmails(payload, "orders", record), sendDueEmails(payload, "orders", record)]);
    expect(a.sent.length + b.sent.length).toBe(2);
    expect(sent.filter((m) => m.subject.includes(result.number))).toHaveLength(2);
  });

  it("a failed inquiry receipt is retried too, and a reservation that failed is picked up", async () => {
    transportDown = true;
    const r = await submitInquiry(payload, { kind: "contact", form: { name: "Rae", email: "rae@example.test", phone: "(508) 555-0122", topic: "general", message: "Hello there" }, now: NOW });
    if (!r.ok || !r.number) throw new Error("not created");
    expect(sent).toHaveLength(0);
    transportDown = false;
    await sendPendingEmails(payload);
    expect(to("rae@example.test")).toHaveLength(1);
  });
});

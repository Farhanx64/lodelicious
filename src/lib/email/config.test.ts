import { describe, expect, it, vi } from "vitest";

import { emailAdapterFromEnv, smtpAdapterStub } from "./adapter";
import { CLOUDFLARE_DEFAULT_FROM, cleanAddress, DEFAULT_ORDER_ALERT_EMAIL, EmailConfigError, resolveEmailPlan, senderFor } from "./config";
import { dueEmails } from "./due";

const SMTP = { EMAIL_TRANSPORT: "smtp", SMTP_HOST: "smtp.example.test", SMTP_PORT: "587", SMTP_USER: "u", SMTP_PASS: "p", EMAIL_FROM: "Shop <shop@example.test>" };

describe("resolveEmailPlan", () => {
  it("defaults to the console", () => {
    expect(resolveEmailPlan({})).toEqual({ transport: "console" });
    expect(resolveEmailPlan({ EMAIL_TRANSPORT: "console", APP_ENV: "production" })).toEqual({ transport: "console" });
  });

  it("refuses an unknown transport", () => {
    expect(() => resolveEmailPlan({ EMAIL_TRANSPORT: "resend" })).toThrow(EmailConfigError);
  });

  it("refuses smtp unless every SMTP variable and EMAIL_FROM are set, naming what is missing", () => {
    expect(() => resolveEmailPlan({ EMAIL_TRANSPORT: "smtp", APP_ENV: "staging" })).toThrow(/SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM/);
    const partial = { ...SMTP, SMTP_PASS: "" };
    expect(() => resolveEmailPlan({ ...partial, APP_ENV: "staging" })).toThrow(/SMTP_PASS/);
    expect(() => resolveEmailPlan({ ...SMTP, SMTP_PORT: "abc", APP_ENV: "staging" })).toThrow(/SMTP_PORT/);
  });

  it("allows smtp away from the live store when complete", () => {
    const plan = resolveEmailPlan({ ...SMTP, APP_ENV: "staging" });
    expect(plan).toMatchObject({ transport: "smtp", smtp: { host: "smtp.example.test", port: 587, secure: false } });
  });

  it("refuses live sending without EMAIL_SEND_LIVE=1, including when APP_ENV is unset or mistyped", () => {
    for (const appEnv of ["production", undefined, "prodution"]) {
      expect(() => resolveEmailPlan({ ...SMTP, APP_ENV: appEnv })).toThrow(/EMAIL_SEND_LIVE=1/);
    }
    expect(() => resolveEmailPlan({ ...SMTP, APP_ENV: "production", EMAIL_SEND_LIVE: "true" })).toThrow(/EMAIL_SEND_LIVE=1/);
    expect(resolveEmailPlan({ ...SMTP, APP_ENV: "production", EMAIL_SEND_LIVE: "1" }).transport).toBe("smtp");
  });
});

describe("the cloudflare transport (D64)", () => {
  const CF = { EMAIL_TRANSPORT: "cloudflare", DEPLOY_TARGET: "cloudflare" };

  it("is allowed off the live store on the Cloudflare build", () => {
    expect(resolveEmailPlan({ ...CF, APP_ENV: "staging" })).toEqual({ transport: "cloudflare" });
    expect(resolveEmailPlan({ ...CF, EMAIL_TRANSPORT: "Cloudflare ", APP_ENV: "local" })).toEqual({ transport: "cloudflare" });
  });

  it("keeps the live-store guard: EMAIL_SEND_LIVE=1 is required, with APP_ENV production, unset or mistyped", () => {
    for (const appEnv of ["production", undefined, "prodution"]) {
      expect(() => resolveEmailPlan({ ...CF, APP_ENV: appEnv })).toThrow(/EMAIL_SEND_LIVE=1/);
    }
    expect(resolveEmailPlan({ ...CF, APP_ENV: "production", EMAIL_SEND_LIVE: "1" })).toEqual({ transport: "cloudflare" });
  });

  it("refuses the Node build, where there is no send_email binding", () => {
    expect(() => resolveEmailPlan({ EMAIL_TRANSPORT: "cloudflare", APP_ENV: "staging" })).toThrow(/DEPLOY_TARGET=cloudflare/);
    expect(() => resolveEmailPlan({ EMAIL_TRANSPORT: "cloudflare", DEPLOY_TARGET: "node", APP_ENV: "staging" })).toThrow(/DEPLOY_TARGET=cloudflare/);
  });

  it("refuses a malformed EMAIL_FROM", () => {
    expect(() => resolveEmailPlan({ ...CF, APP_ENV: "staging", EMAIL_FROM: "orders at shoplodelicious" })).toThrow(/EMAIL_FROM/);
  });

  it("builds the cloudflare adapter", () => {
    const adapter = emailAdapterFromEnv({ ...CF, APP_ENV: "staging" })({ payload: {} as never });
    expect(adapter).toMatchObject({ name: "cloudflare", defaultFromAddress: "orders@shoplodelicious.com", defaultFromName: "Lodelicious" });
  });

  it("sends From orders@shoplodelicious.com with replies to the order alert inbox, unless EMAIL_FROM / EMAIL_REPLY_TO say otherwise", () => {
    const store = { name: "Souset-Pink", email: "lodelicious1@gmail.com" };
    expect(senderFor({ EMAIL_TRANSPORT: "cloudflare" }, store)).toEqual({ from: CLOUDFLARE_DEFAULT_FROM, replyTo: DEFAULT_ORDER_ALERT_EMAIL });
    expect(CLOUDFLARE_DEFAULT_FROM).toBe("Lodelicious <orders@shoplodelicious.com>");
    expect(DEFAULT_ORDER_ALERT_EMAIL).toBe("Lodeliciousorderss@gmail.com");
    expect(senderFor({ EMAIL_TRANSPORT: "cloudflare", EMAIL_FROM: "Shop <hello@shoplodelicious.com>", EMAIL_REPLY_TO: "lody@example.test" }, store)).toEqual({
      from: "Shop <hello@shoplodelicious.com>",
      replyTo: "lody@example.test",
    });
  });
});

describe("adapter selection", () => {
  it("builds the console adapter by default and it only logs", async () => {
    const info = vi.fn();
    const adapter = emailAdapterFromEnv({ APP_ENV: "test" })({ payload: { logger: { info } } as never });
    expect(adapter.name).toBe("console");
    await adapter.sendEmail({ to: "a@example.test", subject: "Hi", text: "Body" });
    expect(info).toHaveBeenCalled();
    expect(JSON.stringify(info.mock.calls)).toContain("NOT SENT");
  });

  it("hides recipient and subject in the console log on the live store", async () => {
    const info = vi.fn();
    const adapter = emailAdapterFromEnv({ APP_ENV: "production" })({ payload: { logger: { info } } as never });
    await adapter.sendEmail({ to: "a@example.test", subject: "Your order", text: "Body" });
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/a@example\.test|Your order|Body/);
  });

  it("smtp is a stub that refuses to start: no code path can send", () => {
    expect(() => emailAdapterFromEnv({ ...SMTP, APP_ENV: "staging" })).toThrow(/not installed/);
    expect(() => smtpAdapterStub({ host: "h", port: 1, secure: false, user: "u", pass: "p" })).toThrow(EmailConfigError);
    expect(() => emailAdapterFromEnv({ EMAIL_TRANSPORT: "smtp", APP_ENV: "staging" })).toThrow(/needs/);
  });
});

describe("sender addresses", () => {
  it("Reply-To defaults to the shop email, From to the shop name and email", () => {
    expect(senderFor({}, { name: "Souset-Pink", email: "shop@example.test" })).toEqual({ from: "Souset-Pink <shop@example.test>", replyTo: "shop@example.test" });
  });

  it("EMAIL_FROM and EMAIL_REPLY_TO win", () => {
    expect(senderFor({ EMAIL_FROM: "Orders <orders@example.test>", EMAIL_REPLY_TO: "lody@example.test" }, { name: "S", email: "shop@example.test" })).toEqual({
      from: "Orders <orders@example.test>",
      replyTo: "lody@example.test",
    });
  });

  it("rejects header injection and junk", () => {
    expect(cleanAddress("a@example.test\r\nBcc: x@example.test")).toBeNull();
    expect(cleanAddress("not an address")).toBeNull();
    expect(senderFor({ EMAIL_FROM: "bad\nfrom", EMAIL_REPLY_TO: "nope" }, { name: "S", email: "shop@example.test" }).replyTo).toBe("shop@example.test");
  });
});

describe("dueEmails", () => {
  it("orders: nothing while pending, failed, unknown or refunded; customer and staff when paid", () => {
    for (const paymentStatus of ["pending", "failed", "refunded"]) expect(dueEmails("orders", { paymentStatus })).toEqual([]);
    expect(dueEmails("orders", { paymentStatus: "unknown", fulfillmentStatus: "awaiting_payment" })).toEqual(["staff_unknown"]);
    expect(dueEmails("orders", { paymentStatus: "paid" })).toEqual(["customer", "staff_new"]);
  });

  it("skips what is already marked, and canceled records", () => {
    expect(dueEmails("orders", { paymentStatus: "paid", emails: { confirmationSentAt: "2026-10-07T00:00:00Z", staffNotifiedAt: "2026-10-07T00:00:00Z" } })).toEqual([]);
    expect(dueEmails("orders", { paymentStatus: "paid", fulfillmentStatus: "canceled" })).toEqual([]);
  });

  it("reservations: deposit_paid and paid_in_full only", () => {
    expect(dueEmails("reservations", { paymentStatus: "deposit_pending" })).toEqual([]);
    expect(dueEmails("reservations", { paymentStatus: "deposit_paid" })).toEqual(["customer", "staff_new"]);
    expect(dueEmails("reservations", { paymentStatus: "paid_in_full" })).toEqual(["customer", "staff_new"]);
  });

  it("stock attention only applies to a paid record", () => {
    expect(dueEmails("orders", { paymentStatus: "paid", stockStatus: "needs_attention", emails: { confirmationSentAt: "x", staffNotifiedAt: "x" } })).toEqual(["staff_attention"]);
    expect(dueEmails("orders", { paymentStatus: "pending", stockStatus: "needs_attention" })).toEqual([]);
  });

  it("status emails (D64): Ready for pickup once for a paid pickup record, Shipped once for a paid order", () => {
    const done = { confirmationSentAt: "x", staffNotifiedAt: "x" };
    expect(dueEmails("orders", { paymentStatus: "paid", fulfillmentStatus: "ready", emails: done })).toEqual(["customer_ready"]);
    expect(dueEmails("orders", { paymentStatus: "paid", fulfillmentStatus: "ready", fulfillment: { method: "pickup" }, emails: done })).toEqual(["customer_ready"]);
    expect(dueEmails("orders", { paymentStatus: "paid", fulfillmentStatus: "ready", fulfillment: { method: "ship" }, emails: done })).toEqual([]);
    expect(dueEmails("orders", { paymentStatus: "paid", fulfillmentStatus: "ready", emails: { ...done, readySentAt: "x" } })).toEqual([]);
    expect(dueEmails("orders", { paymentStatus: "paid", fulfillmentStatus: "shipped", fulfillment: { method: "ship" }, emails: done })).toEqual(["customer_shipped"]);
    expect(dueEmails("orders", { paymentStatus: "paid", fulfillmentStatus: "shipped", emails: { ...done, shippedSentAt: "x" } })).toEqual([]);
    // Not before payment, not after a refund, not once the record has moved on.
    for (const paymentStatus of ["pending", "failed", "unknown", "refunded"]) {
      expect(dueEmails("orders", { paymentStatus, fulfillmentStatus: "ready", emails: { ...done, unknownNotifiedAt: "x" } })).toEqual([]);
      expect(dueEmails("orders", { paymentStatus, fulfillmentStatus: "shipped", emails: { ...done, unknownNotifiedAt: "x" } })).toEqual([]);
    }
    expect(dueEmails("orders", { paymentStatus: "paid", fulfillmentStatus: "completed", emails: done })).toEqual([]);
    // Reservations: ready only (they have no shipped status).
    expect(dueEmails("reservations", { paymentStatus: "deposit_paid", reservationStatus: "ready", emails: done })).toEqual(["customer_ready"]);
    expect(dueEmails("reservations", { paymentStatus: "deposit_paid", reservationStatus: "shipped", emails: done })).toEqual([]);
    expect(dueEmails("reservations", { paymentStatus: "deposit_pending", reservationStatus: "ready" })).toEqual([]);
  });

  it("inquiries owe a receipt and a staff note", () => {
    expect(dueEmails("inquiries", {})).toEqual(["customer", "staff_new"]);
  });
});

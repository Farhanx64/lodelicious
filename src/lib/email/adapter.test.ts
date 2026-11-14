/**
 * The Cloudflare Email Service adapter (D64), against a fake `send_email` binding. Nothing here can send.
 */
import { describe, expect, it, vi } from "vitest";

import type { Payload } from "payload";

import { cloudflareAdapter, htmlToText, toCloudflareAddress, toCloudflareMessage, type CloudflareEmailMessage, type CloudflareSendEmail } from "./adapter";
import { sendEmail } from "./send";

const FROM = "Lodelicious <orders@shoplodelicious.com>";

function fakeBinding(behaviour: "ok" | Error = "ok") {
  const calls: CloudflareEmailMessage[] = [];
  const binding: CloudflareSendEmail = {
    send: vi.fn(async (message: CloudflareEmailMessage) => {
      calls.push(message);
      if (behaviour !== "ok") throw behaviour;
      return { messageId: "msg-1" };
    }),
  };
  return { binding, calls };
}

const codeError = (code: string, message: string) => Object.assign(new Error(message), { code });

describe("toCloudflareAddress", () => {
  it("reads 'Name <address>', a bare address and Payload's { name, address }", () => {
    expect(toCloudflareAddress(FROM)).toEqual({ email: "orders@shoplodelicious.com", name: "Lodelicious" });
    expect(toCloudflareAddress('"Souset-Pink" <shop@example.test>')).toEqual({ email: "shop@example.test", name: "Souset-Pink" });
    expect(toCloudflareAddress("pat@example.test")).toEqual({ email: "pat@example.test" });
    expect(toCloudflareAddress({ name: "Pat", address: "pat@example.test" })).toEqual({ email: "pat@example.test", name: "Pat" });
    expect(toCloudflareAddress("")).toBeNull();
    expect(toCloudflareAddress(undefined)).toBeNull();
  });

  it("refuses an address with a line break, so a header cannot be injected", () => {
    expect(toCloudflareAddress("a@example.test\r\nBcc: x@example.test")).toBeNull();
    expect(toCloudflareAddress({ address: "a@example.test\nBcc: x@example.test" })).toBeNull();
  });
});

describe("toCloudflareMessage", () => {
  it("maps Payload's message to the structured send() object with both html and text", () => {
    const message = toCloudflareMessage({ to: "pat@example.test", from: FROM, replyTo: "Lodeliciousorderss@gmail.com", subject: "Your order\r\nSP-1", text: "Hi", html: "<p>Hi</p>" }, FROM);
    expect(message).toEqual({
      to: { email: "pat@example.test" },
      from: { email: "orders@shoplodelicious.com", name: "Lodelicious" },
      replyTo: { email: "Lodeliciousorderss@gmail.com" },
      subject: "Your order SP-1",
      text: "Hi",
      html: "<p>Hi</p>",
    });
  });

  it("fills in the missing half: text from html, escaped html from text", () => {
    const fromHtml = toCloudflareMessage({ to: "a@example.test", subject: "S", html: "<p>Hello &amp; welcome</p><p>Line<br>two</p>" }, FROM);
    expect(fromHtml.text).toBe("Hello & welcome\nLine\ntwo");
    const fromText = toCloudflareMessage({ to: "a@example.test", subject: "S", text: "1 < 2 & <b>" }, FROM);
    expect(fromText.html).toContain("1 &lt; 2 &amp; &lt;b&gt;");
    expect(fromText.from).toEqual({ email: "orders@shoplodelicious.com", name: "Lodelicious" });
  });

  it("keeps several recipients as a list and refuses none", () => {
    expect(toCloudflareMessage({ to: ["a@example.test", { name: "B", address: "b@example.test" }], subject: "S", text: "x" }, FROM).to).toEqual([{ email: "a@example.test" }, { email: "b@example.test", name: "B" }]);
    expect(() => toCloudflareMessage({ to: [], subject: "S", text: "x" }, FROM)).toThrow(/no recipient/);
  });

  it("htmlToText drops style and head", () => {
    expect(htmlToText("<html><head><title>T</title><style>p{}</style></head><body><h2>Hi</h2>there</body></html>")).toBe("Hi\nthere");
  });
});

describe("cloudflareAdapter", () => {
  const payload = {} as Payload;

  it("sends through the binding and returns its message id", async () => {
    const { binding, calls } = fakeBinding();
    const adapter = cloudflareAdapter({ getBinding: async () => binding })({ payload });
    expect(adapter.name).toBe("cloudflare");
    await expect(adapter.sendEmail({ to: "pat@example.test", from: FROM, subject: "S", text: "T", html: "<p>T</p>" })).resolves.toEqual({ messageId: "msg-1" });
    expect(calls).toHaveLength(1);
    expect(calls[0].from).toEqual({ email: "orders@shoplodelicious.com", name: "Lodelicious" });
  });

  it("uses the default From when Payload sends without one", async () => {
    const { binding, calls } = fakeBinding();
    await cloudflareAdapter({ getBinding: async () => binding })({ payload }).sendEmail({ to: "staff@example.test", subject: "Reset", html: "<p>x</p>" });
    expect(calls[0].from).toEqual({ email: "orders@shoplodelicious.com", name: "Lodelicious" });
    expect(calls[0].text).toBe("x");
  });

  it("throws, with Cloudflare's error code, when the binding refuses", async () => {
    const { binding } = fakeBinding(codeError("E_SENDER_NOT_VERIFIED", "sender orders@shoplodelicious.com is not verified"));
    const adapter = cloudflareAdapter({ getBinding: async () => binding })({ payload });
    await expect(adapter.sendEmail({ to: "pat@example.test", subject: "S", text: "T" })).rejects.toThrow(/E_SENDER_NOT_VERIFIED/);
  });

  it("throws when the binding is missing (the payload command line, or a Worker without send_email)", async () => {
    await expect(cloudflareAdapter({ getBinding: async () => undefined })({ payload }).sendEmail({ to: "a@example.test", subject: "S", text: "T" })).rejects.toThrow(/EMAIL send_email binding is not available/);
    await expect(
      cloudflareAdapter({
        getBinding: async () => {
          throw new Error("no context");
        },
      })({ payload }).sendEmail({ to: "a@example.test", subject: "S", text: "T" }),
    ).rejects.toThrow(/not available/);
  });

  it("a refusal becomes a failed, redacted outcome in sendEmail, which the caller turns into a retry", async () => {
    const { binding } = fakeBinding(codeError("E_RECIPIENT_SUPPRESSED", "pat@example.test is suppressed"));
    const adapter = cloudflareAdapter({ getBinding: async () => binding })({ payload });
    const fakePayload = { sendEmail: adapter.sendEmail } as unknown as Payload;
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const outcome = await sendEmail(fakePayload, { to: "pat@example.test", from: FROM, replyTo: null, subject: "S", text: "T", html: "<p>T</p>", label: "customer_order", ref: "SP-1" });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toContain("E_RECIPIENT_SUPPRESSED");
      expect(outcome.error).not.toContain("pat@example.test");
    }
    errors.mockRestore();
  });
});

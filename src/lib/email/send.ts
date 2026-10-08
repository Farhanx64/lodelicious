/**
 * The one way the app sends an email (D44): wraps `payload.sendEmail`, with a timeout, and logs a single
 * redacted line. The line carries the kind of email, our own record number and the outcome, never an
 * address, a name or the message. Never throws: the caller decides what a failure means.
 *
 * Which transport is behind `payload.sendEmail` is decided in `adapter.ts` (the console by default).
 * Tests replace `payload.sendEmail` with a capturing function.
 */
import type { Payload } from "payload";

import type { Rendered } from "./templates";

export type OutgoingEmail = Rendered & {
  to: string;
  from: string | null;
  replyTo: string | null;
  /** For the log line only: "customer_order", "staff_new_order", and so on. */
  label: string;
  /** For the log line only: our own record number, such as SP-1001. */
  ref: string;
};

export type SendOutcome = { ok: true } | { ok: false; error: string };

export const SEND_TIMEOUT_MS = 15_000;

/** An error message with anything that looks like an email address removed, so logs hold no personal data. */
export function redact(message: string): string {
  return message.replace(/[^\s<>"',;]+@[^\s<>"',;]+/g, "[address]").slice(0, 300);
}

export async function sendEmail(payload: Payload, mail: OutgoingEmail, timeoutMs: number = SEND_TIMEOUT_MS): Promise<SendOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (!mail.from) throw new Error("no From address (set EMAIL_FROM or the shop email in Store settings)");
    const sending = payload.sendEmail({
      to: mail.to,
      from: mail.from,
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    sending.catch(() => undefined);
    await Promise.race([sending, new Promise((_, reject) => (timer = setTimeout(() => reject(new Error("timed out")), timeoutMs)))]);
    console.info(`[email] handed over ${mail.label} ${mail.ref}`);
    return { ok: true };
  } catch (e) {
    const error = redact(e instanceof Error ? e.message : String(e));
    console.error(`[email] FAILED ${mail.label} ${mail.ref}: ${error}`);
    return { ok: false, error };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

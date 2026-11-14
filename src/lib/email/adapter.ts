/**
 * The email adapter Payload is built with (D44). Wired in `payload.config.ts` through `emailAdapterFromEnv`.
 *
 * - console (default): nothing leaves the machine. Outside the live store the message is printed so it can
 *   be read while developing; on the live store only a one-line summary is logged.
 * - cloudflare (D64): Cloudflare Email Service, through the Worker's `send_email` binding named EMAIL
 *   (wrangler.jsonc). The binding is looked up per message from OpenNext's request context, so this works
 *   inside the deployed Worker, its Cron Triggers (they call the app through `fetch`) and `wrangler dev`
 *   (which only simulates sending). Anywhere without the binding (the `payload` command line) the send
 *   fails, the marker is cleared, and the Worker's send-pending-emails job retries it.
 * - smtp: a stub. `@payloadcms/email-nodemailer` (and nodemailer) are NOT installed in this project, and
 *   this work was not allowed to add dependencies, so there is no code path that can send. With complete,
 *   permitted settings it fails to start with a message saying so. To finish, once Lody approves a sending
 *   service: `npm install @payloadcms/email-nodemailer nodemailer`, then replace `smtpAdapterStub` with
 *
 *     import { nodemailerAdapter } from "@payloadcms/email-nodemailer";
 *     nodemailerAdapter({ defaultFromAddress, defaultFromName,
 *       transportOptions: { host, port, secure, auth: { user, pass }, connectionTimeout: 10_000, socketTimeout: 15_000 } })
 *
 *   The environment checks in `config.ts` stay in front of it, so it still cannot start incompletely
 *   configured, and cannot send from the live store without EMAIL_SEND_LIVE=1.
 */
import type { EmailAdapter, SendEmailOptions } from "payload";

import { isPreviewEnv, type EnvLike } from "../app-env";
import { CLOUDFLARE_DEFAULT_FROM, EMAIL_BINDING, EmailConfigError, resolveEmailPlan, type SmtpSettings } from "./config";

const toList = (to: SendEmailOptions["to"]): string =>
  (Array.isArray(to) ? to : [to]).map((t) => (typeof t === "string" ? t : ((t as { address?: string } | undefined)?.address ?? "?"))).join(", ");

export function consoleAdapter(env: EnvLike = process.env): EmailAdapter {
  return ({ payload }) => ({
    name: "console",
    defaultFromAddress: "no-reply@localhost",
    defaultFromName: "Lodelicious",
    sendEmail: async (message) => {
      const verbose = isPreviewEnv(env);
      payload.logger.info({
        msg: `[email:console] NOT SENT (no sending service connected). To: ${verbose ? toList(message.to) : "(hidden)"}; Subject: ${verbose ? String(message.subject) : "(hidden)"}`,
      });
      if (verbose && message.text) payload.logger.info({ msg: `[email:console] ${String(message.text).slice(0, 4000)}` });
    },
  });
}

// ---------------------------------------------------------------- Cloudflare Email Service (D64)

/** An address as Cloudflare's structured `send()` takes it. */
export type CloudflareAddress = { email: string; name?: string };

/** The message `env.EMAIL.send()` takes (developers.cloudflare.com/email-service/api/send-emails/workers-api/). */
export type CloudflareEmailMessage = {
  to: string | CloudflareAddress | (string | CloudflareAddress)[];
  from: string | CloudflareAddress;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string | CloudflareAddress;
};

/** The `send_email` binding. Errors are thrown as `Error`s with a `code` such as E_SENDER_NOT_VERIFIED. */
export type CloudflareSendEmail = { send(message: CloudflareEmailMessage): Promise<{ messageId: string }> };

type AnyAddress = string | { address?: string; name?: string } | undefined | null;

/** "Name <a@b.c>", "a@b.c" or Payload's `{ name, address }`, as `{ email, name }`; null when there is no address. */
export function toCloudflareAddress(value: AnyAddress): CloudflareAddress | null {
  if (!value) return null;
  if (typeof value !== "string") {
    const email = (value.address ?? "").trim();
    if (/[\r\n]/.test(email)) return null;
    const name = (value.name ?? "").replace(/[\r\n"<>]/g, "").trim();
    return email ? (name ? { email, name } : { email }) : null;
  }
  if (/[\r\n]/.test(value)) return null;
  const v = value.trim();
  const angle = /^(.*)<([^<>]+)>\s*$/.exec(v);
  if (angle) {
    const name = angle[1].replace(/^\s*"|"\s*$/g, "").trim();
    const email = angle[2].trim();
    return email ? (name ? { email, name } : { email }) : null;
  }
  return v ? { email: v } : null;
}

const addressList = (to: SendEmailOptions["to"]): CloudflareAddress[] =>
  (Array.isArray(to) ? to : [to]).map((t) => toCloudflareAddress(t as AnyAddress)).filter((a): a is CloudflareAddress => a !== null);

/** Plain text from simple HTML, for the rare message (Payload's own) that comes without text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head|title)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr|li|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const escapeForHtml = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Payload's message as Cloudflare's structured message, always with both html and text. Throws on a missing recipient. */
export function toCloudflareMessage(message: SendEmailOptions, fallbackFrom: string): CloudflareEmailMessage {
  const to = addressList(message.to);
  if (!to.length) throw new Error("no recipient");
  const from = toCloudflareAddress((message.from as AnyAddress) ?? fallbackFrom) ?? toCloudflareAddress(fallbackFrom);
  if (!from) throw new Error("no From address");
  const replyTo = toCloudflareAddress(message.replyTo as AnyAddress);
  const html = typeof message.html === "string" ? message.html : "";
  const text = typeof message.text === "string" ? message.text : "";
  return {
    to: to.length === 1 ? to[0] : to,
    from,
    subject: String(message.subject ?? "").replace(/[\r\n]+/g, " ").trim(),
    text: text || htmlToText(html),
    html: html || `<pre style="font-family:inherit;white-space:pre-wrap;">${escapeForHtml(text)}</pre>`,
    ...(replyTo ? { replyTo } : {}),
  };
}

/** The binding from OpenNext's request context. Loaded only on the Cloudflare build (see src/platform/target.ts). */
async function bindingFromContext(): Promise<CloudflareSendEmail | undefined> {
  if (process.env.DEPLOY_TARGET === "cloudflare") {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return (env as unknown as Record<string, CloudflareSendEmail | undefined>)[EMAIL_BINDING];
  }
  return undefined;
}

export function cloudflareAdapter(opts: { getBinding?: () => Promise<CloudflareSendEmail | undefined> } = {}): EmailAdapter<{ messageId: string }> {
  const getBinding = opts.getBinding ?? bindingFromContext;
  const fallback = toCloudflareAddress(CLOUDFLARE_DEFAULT_FROM) as CloudflareAddress;
  return () => ({
    name: "cloudflare",
    defaultFromAddress: fallback.email,
    defaultFromName: fallback.name ?? "Lodelicious",
    sendEmail: async (message) => {
      const binding = await getBinding().catch(() => undefined);
      if (!binding || typeof binding.send !== "function") throw new Error(`the ${EMAIL_BINDING} send_email binding is not available here`);
      try {
        return await binding.send(toCloudflareMessage(message, CLOUDFLARE_DEFAULT_FROM));
      } catch (e) {
        const code = (e as { code?: unknown } | null)?.code;
        const text = e instanceof Error ? e.message : String(e);
        // send.ts redacts addresses from this before it is logged.
        throw new Error(`Cloudflare Email Service refused the message${typeof code === "string" ? ` (${code})` : ""}: ${text}`);
      }
    },
  });
}

/** Placeholder for the nodemailer adapter: see the file comment. Throws when built, never sends. */
export function smtpAdapterStub(settings: SmtpSettings): EmailAdapter {
  void settings;
  throw new EmailConfigError(
    "EMAIL_TRANSPORT=smtp is set and complete, but the SMTP adapter is not installed (@payloadcms/email-nodemailer is not in node_modules). Install it and finish src/lib/email/adapter.ts, or unset EMAIL_TRANSPORT to log emails instead.",
  );
}

/** Build-time choice of adapter. Throws EmailConfigError (so the app refuses to start) on unsafe settings. */
export function emailAdapterFromEnv(env: EnvLike = process.env): EmailAdapter {
  // DEPLOY_TARGET is inlined into the bundle by next.config.ts and is not in the Worker's runtime env.
  const plan = resolveEmailPlan({ ...env, DEPLOY_TARGET: env.DEPLOY_TARGET ?? process.env.DEPLOY_TARGET });
  if (plan.transport === "cloudflare") return cloudflareAdapter() as EmailAdapter;
  return plan.transport === "smtp" ? smtpAdapterStub(plan.smtp) : consoleAdapter(env);
}

/**
 * The email adapter Payload is built with (D44). Wired in `payload.config.ts` through `emailAdapterFromEnv`.
 *
 * - console (default): nothing leaves the machine. Outside the live store the message is printed so it can
 *   be read while developing; on the live store only a one-line summary is logged.
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
import { EmailConfigError, resolveEmailPlan, type SmtpSettings } from "./config";

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

/** Placeholder for the nodemailer adapter: see the file comment. Throws when built, never sends. */
export function smtpAdapterStub(settings: SmtpSettings): EmailAdapter {
  void settings;
  throw new EmailConfigError(
    "EMAIL_TRANSPORT=smtp is set and complete, but the SMTP adapter is not installed (@payloadcms/email-nodemailer is not in node_modules). Install it and finish src/lib/email/adapter.ts, or unset EMAIL_TRANSPORT to log emails instead.",
  );
}

/** Build-time choice of adapter. Throws EmailConfigError (so the app refuses to start) on unsafe settings. */
export function emailAdapterFromEnv(env: EnvLike = process.env): EmailAdapter {
  const plan = resolveEmailPlan(env);
  return plan.transport === "smtp" ? smtpAdapterStub(plan.smtp) : consoleAdapter(env);
}

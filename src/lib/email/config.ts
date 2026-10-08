/**
 * Which email transport this process may use, from environment variables (D44). Framework-free.
 *
 *   EMAIL_TRANSPORT   unset or "console" (the default): emails are only written to the log.
 *                     "smtp": a real SMTP server. Refuses to start unless every SMTP variable is set,
 *                     and, on the live store, unless EMAIL_SEND_LIVE=1 as well.
 *   EMAIL_FROM        The From address, "Name <address>" or a bare address. Required for smtp. Must be on a
 *                     domain the sending service has verified (SPF/DKIM), which is Lody's decision.
 *   EMAIL_REPLY_TO    Where customer replies go. Defaults to the shop email in Store settings.
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS   the SMTP server and login; SMTP_SECURE=1 for implicit TLS (port 465).
 *   EMAIL_SEND_LIVE   "1" lets the live store (APP_ENV not local, staging or test) send real email.
 *
 * Tests never set EMAIL_TRANSPORT, so they cannot send; they capture messages in memory instead.
 */
import { isProductionEnv, type EnvLike } from "../app-env";

export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigError";
  }
}

export type SmtpSettings = { host: string; port: number; secure: boolean; user: string; pass: string };

export type EmailPlan = { transport: "console" } | { transport: "smtp"; smtp: SmtpSettings };

const SMTP_VARS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"] as const;
const clean = (v: string | undefined | null): string => (v ?? "").trim();

/** Decide the transport, or throw an EmailConfigError that says exactly what is missing. */
export function resolveEmailPlan(env: EnvLike = process.env): EmailPlan {
  const transport = clean(env.EMAIL_TRANSPORT).toLowerCase();
  if (transport === "" || transport === "console") return { transport: "console" };
  if (transport !== "smtp") throw new EmailConfigError(`EMAIL_TRANSPORT must be "console" or "smtp" (got "${transport}"). Nothing was sent.`);

  const missing: string[] = SMTP_VARS.filter((name) => !clean(env[name]));
  if (!clean(env.EMAIL_FROM)) missing.push("EMAIL_FROM");
  if (missing.length) throw new EmailConfigError(`EMAIL_TRANSPORT=smtp needs ${missing.join(", ")}. Refusing to start with incomplete email settings.`);

  const port = Number(clean(env.SMTP_PORT));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new EmailConfigError("SMTP_PORT must be a port number between 1 and 65535.");

  if (isProductionEnv(env) && clean(env.EMAIL_SEND_LIVE) !== "1") {
    throw new EmailConfigError("This is the live store (APP_ENV is not local, staging or test): real email also needs EMAIL_SEND_LIVE=1. Refusing to start.");
  }
  return { transport: "smtp", smtp: { host: clean(env.SMTP_HOST), port, secure: clean(env.SMTP_SECURE) === "1", user: clean(env.SMTP_USER), pass: env.SMTP_PASS ?? "" } };
}

/** "Name <a@b.c>" or "a@b.c" with no line breaks (header injection) and a plausible address, or null. */
export function cleanAddress(value: string | undefined | null): string | null {
  const v = clean(value);
  if (!v || /[\r\n]/.test(v)) return null;
  const bare = /<([^<>]+)>\s*$/.exec(v)?.[1] ?? v;
  return /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(bare) ? v : null;
}

/** The From and Reply-To for outgoing mail. Reply-To defaults to the shop email; From to the shop name and email. */
export function senderFor(env: EnvLike, store: { name?: string | null; email?: string | null }): { from: string | null; replyTo: string | null } {
  const shopEmail = cleanAddress(store.email);
  const shopName = (store.name ?? "").replace(/[\r\n"<>]/g, "").trim();
  const fallbackFrom = shopEmail ? (shopName ? `${shopName} <${shopEmail}>` : shopEmail) : null;
  return { from: cleanAddress(env.EMAIL_FROM) ?? fallbackFrom, replyTo: cleanAddress(env.EMAIL_REPLY_TO) ?? shopEmail };
}

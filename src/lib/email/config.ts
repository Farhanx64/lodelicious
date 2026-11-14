/**
 * Which email transport this process may use, from environment variables (D44). Framework-free.
 *
 *   EMAIL_TRANSPORT   unset or "console" (the default): emails are only written to the log.
 *                     "cloudflare": Cloudflare Email Service through the Worker's `send_email` binding
 *                     (D64). Only on the Cloudflare build (DEPLOY_TARGET=cloudflare); on the live store
 *                     only with EMAIL_SEND_LIVE=1 as well.
 *                     "smtp": a real SMTP server. Refuses to start unless every SMTP variable is set,
 *                     and, on the live store, unless EMAIL_SEND_LIVE=1 as well.
 *   EMAIL_FROM        The From address, "Name <address>" or a bare address. Required for smtp. Must be on a
 *                     domain the sending service has verified (SPF/DKIM). For cloudflare it defaults to
 *                     CLOUDFLARE_DEFAULT_FROM, on the domain onboarded to Email Sending.
 *   EMAIL_REPLY_TO    Where customer replies go. Defaults to the shop email in Store settings (for
 *                     cloudflare: the order alert address, DEFAULT_ORDER_ALERT_EMAIL).
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS   the SMTP server and login; SMTP_SECURE=1 for implicit TLS (port 465).
 *   EMAIL_SEND_LIVE   "1" lets the live store (APP_ENV not local, staging or test) send real email.
 *
 * Tests never set EMAIL_TRANSPORT, so they cannot send; they capture messages in memory instead.
 */
import { isProductionEnv, type EnvLike } from "../app-env";

/** Where staff order alerts go unless Lody changes it in Store details (D54). The double "s" is intentional. */
export const DEFAULT_ORDER_ALERT_EMAIL = "Lodeliciousorderss@gmail.com";

/** The cloudflare transport's From unless EMAIL_FROM says otherwise (D64): shoplodelicious.com is onboarded to Email Sending. */
export const CLOUDFLARE_DEFAULT_FROM = "Lodelicious <orders@shoplodelicious.com>";

/** The Worker binding name (wrangler.jsonc `send_email[].name`). */
export const EMAIL_BINDING = "EMAIL";

export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigError";
  }
}

export type SmtpSettings = { host: string; port: number; secure: boolean; user: string; pass: string };

export type EmailPlan = { transport: "console" } | { transport: "cloudflare" } | { transport: "smtp"; smtp: SmtpSettings };

const SMTP_VARS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"] as const;
const clean = (v: string | undefined | null): string => (v ?? "").trim();

/** Decide the transport, or throw an EmailConfigError that says exactly what is missing. */
export function resolveEmailPlan(env: EnvLike = process.env): EmailPlan {
  const transport = clean(env.EMAIL_TRANSPORT).toLowerCase();
  if (transport === "" || transport === "console") return { transport: "console" };
  const liveGuard = () => {
    if (isProductionEnv(env) && clean(env.EMAIL_SEND_LIVE) !== "1") {
      throw new EmailConfigError("This is the live store (APP_ENV is not local, staging or test): real email also needs EMAIL_SEND_LIVE=1. Refusing to start.");
    }
  };
  if (transport === "cloudflare") {
    if (clean(env.DEPLOY_TARGET) !== "cloudflare") throw new EmailConfigError("EMAIL_TRANSPORT=cloudflare works only on the Cloudflare build (DEPLOY_TARGET=cloudflare). Unset EMAIL_TRANSPORT to log emails instead.");
    if (clean(env.EMAIL_FROM) && !cleanAddress(env.EMAIL_FROM)) throw new EmailConfigError("EMAIL_FROM is not a valid address. Refusing to start.");
    liveGuard();
    return { transport: "cloudflare" };
  }
  if (transport !== "smtp") throw new EmailConfigError(`EMAIL_TRANSPORT must be "console", "cloudflare" or "smtp" (got "${transport}"). Nothing was sent.`);

  const missing: string[] = SMTP_VARS.filter((name) => !clean(env[name]));
  if (!clean(env.EMAIL_FROM)) missing.push("EMAIL_FROM");
  if (missing.length) throw new EmailConfigError(`EMAIL_TRANSPORT=smtp needs ${missing.join(", ")}. Refusing to start with incomplete email settings.`);

  const port = Number(clean(env.SMTP_PORT));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new EmailConfigError("SMTP_PORT must be a port number between 1 and 65535.");

  liveGuard();
  return { transport: "smtp", smtp: { host: clean(env.SMTP_HOST), port, secure: clean(env.SMTP_SECURE) === "1", user: clean(env.SMTP_USER), pass: env.SMTP_PASS ?? "" } };
}

/** "Name <a@b.c>" or "a@b.c" with no line breaks (header injection) and a plausible address, or null. */
export function cleanAddress(value: string | undefined | null): string | null {
  const v = clean(value);
  if (!v || /[\r\n]/.test(v)) return null;
  const bare = /<([^<>]+)>\s*$/.exec(v)?.[1] ?? v;
  return /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(bare) ? v : null;
}

/**
 * The From and Reply-To for outgoing mail. Reply-To defaults to the shop email; From to the shop name and email.
 * With the cloudflare transport (D64) the From must be on the onboarded domain, so it defaults to
 * CLOUDFLARE_DEFAULT_FROM, and replies go to the order alert inbox Lody reads.
 */
export function senderFor(env: EnvLike, store: { name?: string | null; email?: string | null }): { from: string | null; replyTo: string | null } {
  const shopEmail = cleanAddress(store.email);
  if (clean(env.EMAIL_TRANSPORT).toLowerCase() === "cloudflare") {
    return { from: cleanAddress(env.EMAIL_FROM) ?? CLOUDFLARE_DEFAULT_FROM, replyTo: cleanAddress(env.EMAIL_REPLY_TO) ?? DEFAULT_ORDER_ALERT_EMAIL };
  }
  const shopName = (store.name ?? "").replace(/[\r\n"<>]/g, "").trim();
  const fallbackFrom = shopEmail ? (shopName ? `${shopName} <${shopEmail}>` : shopEmail) : null;
  return { from: cleanAddress(env.EMAIL_FROM) ?? fallbackFrom, replyTo: cleanAddress(env.EMAIL_REPLY_TO) ?? shopEmail };
}

/**
 * Member passwords and sessions (D45). Members are not Payload auth users: staff accounts are, and
 * keeping customers out of Payload's auth means a member can never sign in to the admin or the REST
 * API, and no staff access rule ever has to tell a customer from a staff member.
 *
 * - Passwords: scrypt (Node's built-in), a random salt per password, compared in constant time. The
 *   stored form names its parameters, so they can be raised later without breaking old hashes.
 * - Sessions: a signed cookie value carrying the member id, the member's session version and an
 *   expiry. Changing the password or signing out everywhere bumps the version, which ends every
 *   older session. The signature uses PAYLOAD_SECRET with its own purpose label, like the other
 *   signed values (D42).
 * - Reset tokens: random, sent by email, stored only as a hash, valid for an hour, used once.
 */
import crypto from "node:crypto";

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

function scrypt(password: string, salt: Buffer, N: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password.normalize("NFKC"), salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.keylen);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/** A hash of a random password, compared against when the email is unknown, so timing doesn't tell whether an account exists. */
let decoy: Promise<string> | null = null;
export const decoyHash = (): Promise<string> => (decoy ??= hashPassword(crypto.randomBytes(18).toString("base64url")));

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const parts = String(stored ?? "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    await scrypt(password, Buffer.alloc(16), SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.keylen);
    return false;
  }
  const [, n, r, p, salt, key] = parts;
  const expected = Buffer.from(key, "base64url");
  const N = Number(n);
  if (!Number.isSafeInteger(N) || N < 1024 || N > 1 << 20 || expected.length < 32) return false;
  const actual = await scrypt(password, Buffer.from(salt, "base64url"), N, Number(r), Number(p), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// ---------------------------------------------------------------- sessions

export const SESSION_DAYS = 30;

export type SessionClaims = { memberId: number; version: number; expiresAt: number };

function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`member-session:${body}`).digest("base64url");
}

function secretOf(secret: string | undefined): string {
  if (!secret) throw new Error("PAYLOAD_SECRET is required");
  return secret;
}

export function issueSession(memberId: number, version: number, now: Date, secret = process.env.PAYLOAD_SECRET): string {
  const body = Buffer.from(JSON.stringify({ m: memberId, v: version, e: now.getTime() + SESSION_DAYS * 86_400_000 })).toString("base64url");
  return `${body}.${sign(body, secretOf(secret))}`;
}

/** The claims of a session this server issued that hasn't expired, otherwise null. The member's version is checked by the caller. */
export function readSession(value: string | undefined, now: Date, secret = process.env.PAYLOAD_SECRET): SessionClaims | null {
  if (!value || value.length > 400) return null;
  const [body, mac] = value.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body, secretOf(secret)));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { m?: unknown; v?: unknown; e?: unknown };
    if (!Number.isSafeInteger(data.m) || !Number.isSafeInteger(data.v) || typeof data.e !== "number" || data.e <= now.getTime()) return null;
    return { memberId: data.m as number, version: data.v as number, expiresAt: data.e };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- reset tokens

export const RESET_MINUTES = 60;

export const newResetToken = (): string => crypto.randomBytes(32).toString("base64url");

export const hashResetToken = (token: string): string => crypto.createHash("sha256").update(`member-reset:${token}`).digest("hex");

// ---------------------------------------------------------------- input

export const normaliseEmail = (email: unknown): string => String(email ?? "").trim().toLowerCase().slice(0, 200);

export const looksLikeEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

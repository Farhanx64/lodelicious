/**
 * Creating the first owner without opening /admin (D41, audit A03). Until the first account
 * exists, Payload's create-first-user screen and `/api/users/first-register` are open to anyone,
 * and whoever registers becomes the owner. On a new public host that is a race a bot can win.
 * So the owner is created at deploy time, from environment variables, before the site is shared:
 *
 *   OWNER_EMAIL=lody@example.com OWNER_PASSWORD='…' npx payload run scripts/create-owner.ts
 *
 * It refuses when any user already exists. When FIRST_OWNER_EMAIL is also set, the Users
 * collection rejects any other email for the first account (including through the admin screen).
 */
import type { Payload } from "payload";

import { MIN_PASSWORD_LENGTH, passwordProblem } from "./password-policy";

/** Reads OWNER_EMAIL, OWNER_PASSWORD and FIRST_OWNER_EMAIL. */
export type OwnerEnv = Record<string, string | undefined>;

export type OwnerResult = { ok: true; email: string } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The message Payload attached to a failed validation, or the error's own message. */
function messageOf(error: unknown): string {
  const first = (error as { data?: { errors?: { message?: string }[] } })?.data?.errors?.[0]?.message;
  return first ?? (error instanceof Error ? error.message : "The account could not be created.");
}

export async function createFirstOwner(payload: Payload, env: OwnerEnv): Promise<OwnerResult> {
  const email = (env.OWNER_EMAIL ?? "").trim();
  const password = env.OWNER_PASSWORD ?? "";
  if (!email || !password) return { ok: false, error: "Set OWNER_EMAIL and OWNER_PASSWORD in the environment, then run this again." };
  if (!EMAIL.test(email)) return { ok: false, error: "OWNER_EMAIL is not a valid email address." };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: `OWNER_PASSWORD is not strong enough (needs ${MIN_PASSWORD_LENGTH}+ characters). ${problem}` };
  const expected = env.FIRST_OWNER_EMAIL?.trim();
  if (expected && !sameEmail(expected, email)) {
    return { ok: false, error: "OWNER_EMAIL does not match FIRST_OWNER_EMAIL, so the first account would be refused. Fix one of them." };
  }

  const { totalDocs } = await payload.count({ collection: "users", overrideAccess: true });
  if (totalDocs > 0) return { ok: false, error: "A user account already exists, so nothing was created. This script only creates the very first owner; add staff in /admin." };

  try {
    await payload.create({ collection: "users", data: { email, password, roles: ["owner"] }, overrideAccess: true });
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
  return { ok: true, email };
}

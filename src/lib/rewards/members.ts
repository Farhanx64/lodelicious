/**
 * Rewards members (D45): joining, signing in, password resets and what the account page shows.
 * Framework free (takes the Payload instance and "now"), so the integration tests drive the code the
 * server actions run. Cookies live in ./session.ts.
 *
 * Messages never say whether an email has an account, except when joining with one that already
 * does (the usual trade-off: the alternative is a sign-up that silently does nothing).
 */
import type { Payload } from "payload";

import type { Member, RewardsSetting, StoreSetting } from "@/payload-types";

import type { EnvLike } from "../app-env";
import { isPreviewEnv } from "../app-env";
import { senderFor } from "../email/config";
import { siteUrl } from "../email/notify";
import { sendEmail } from "../email/send";
import { memberPasswordReset } from "../email/templates";
import { passwordProblem } from "../password-policy";
import { decoyHash, hashPassword, hashResetToken, looksLikeEmail, newResetToken, normaliseEmail, RESET_MINUTES, verifyPassword } from "./credentials";
import { entryKey, ENTRY_LABELS, postEntry, type EntryKind } from "./ledger";
import { DEFAULT_PROGRAM_NAME, type RewardsConfig } from "./program";

export const MAX_FAILED_SIGN_INS = 5;
export const LOCK_MINUTES = 15;

export const SIGN_IN_FAILED = "That email and password don't match an account, or the account is paused for a few minutes after too many tries.";

export async function loadRewardsConfig(payload: Payload): Promise<RewardsConfig> {
  const s = (await payload.findGlobal({ slug: "rewards-settings", depth: 0, overrideAccess: true })) as RewardsSetting;
  return {
    enabled: Boolean(s.enabled),
    approved: Boolean(s.approved),
    programName: s.programName?.trim() || DEFAULT_PROGRAM_NAME,
    pointsPerDollar: typeof s.pointsPerDollar === "number" ? s.pointsPerDollar : null,
    welcomePoints: typeof s.welcomePoints === "number" ? s.welcomePoints : 0,
    options: (s.rewards ?? []).map((r, i) => ({ id: r.id ?? String(i), pointsRequired: r.pointsRequired, discountCents: r.discountCents })),
    terms: s.terms?.trim() ?? "",
  };
}

/** What the storefront may know about a signed-in member. */
export type MemberView = { id: number; name: string; email: string; phone: string; pointsBalance: number; sessionVersion: number };

const view = (m: Member): MemberView => ({
  id: m.id,
  name: m.name,
  email: m.email,
  phone: m.phone ?? "",
  pointsBalance: Number(m.pointsBalance ?? 0),
  sessionVersion: Number(m.sessionVersion ?? 0),
});

async function findByEmail(payload: Payload, email: string): Promise<Member | null> {
  const { docs } = await payload.find({ collection: "members", where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true });
  return (docs[0] as Member | undefined) ?? null;
}

/** The member a session names, if it is still valid: the account is open and the session wasn't ended by a password change. */
export async function memberForSession(payload: Payload, claims: { memberId: number; version: number } | null): Promise<MemberView | null> {
  if (!claims) return null;
  const m = (await payload.findByID({ collection: "members", id: claims.memberId, depth: 0, overrideAccess: true, showHiddenFields: true }).catch(() => null)) as Member | null;
  if (!m || m.status !== "active" || Number(m.sessionVersion ?? 0) !== claims.version) return null;
  return view(m);
}

export type JoinResult = { ok: true; member: MemberView } | { ok: false; error: string };

export async function joinMember(payload: Payload, form: Record<string, unknown>, config: RewardsConfig, now: Date = new Date()): Promise<JoinResult> {
  const name = String(form.name ?? "").trim().slice(0, 100);
  const email = normaliseEmail(form.email);
  const phone = String(form.phone ?? "").trim().slice(0, 30);
  const password = String(form.password ?? "");
  if (!name) return { ok: false, error: "Please enter your name." };
  if (!looksLikeEmail(email)) return { ok: false, error: "Please enter a valid email address." };
  if (phone && phone.replace(/\D/g, "").length < 10) return { ok: false, error: "Please enter a full phone number, or leave it empty." };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };
  if (form.agree !== "yes" && form.agree !== "on") return { ok: false, error: `Please confirm you agree to the ${config.programName} terms.` };

  if (await findByEmail(payload, email)) return { ok: false, error: "There's already an account with this email. Sign in, or reset your password if you've forgotten it." };
  let member: Member;
  try {
    member = (await payload.create({
      collection: "members",
      data: { name, email, phone, status: "active", passwordHash: await hashPassword(password), sessionVersion: 0, failedSignIns: 0, termsAcceptedAt: now.toISOString(), lastSignInAt: now.toISOString() },
      overrideAccess: true,
    })) as Member;
  } catch (e) {
    // Two sign-ups with the same email at once: the unique index lets one through.
    if (await findByEmail(payload, email)) return { ok: false, error: "There's already an account with this email. Sign in, or reset your password if you've forgotten it." };
    throw e;
  }
  if (config.welcomePoints > 0) {
    await postEntry(payload, { memberId: member.id, kind: "welcome", points: config.welcomePoints, key: entryKey.welcome(member) }, now);
  }
  return { ok: true, member: { ...view(member), pointsBalance: config.welcomePoints > 0 ? config.welcomePoints : 0 } };
}

export type SignInResult = { ok: true; member: MemberView } | { ok: false; error: string };

export async function signIn(payload: Payload, form: Record<string, unknown>, now: Date = new Date()): Promise<SignInResult> {
  const email = normaliseEmail(form.email);
  const password = String(form.password ?? "").slice(0, 200);
  const member = looksLikeEmail(email) ? await findByEmail(payload, email) : null;
  if (!member || member.status !== "active") {
    await verifyPassword(password, await decoyHash());
    return { ok: false, error: SIGN_IN_FAILED };
  }
  const locked = member.lockedUntil && new Date(member.lockedUntil).getTime() > now.getTime();
  // The password is checked even while locked, so a locked account answers as slowly as any other.
  const matches = await verifyPassword(password, member.passwordHash);
  if (locked) return { ok: false, error: SIGN_IN_FAILED };
  if (!matches) {
    const failed = Number(member.failedSignIns ?? 0) + 1;
    const lock = failed >= MAX_FAILED_SIGN_INS;
    await payload.update({
      collection: "members",
      id: member.id,
      data: { failedSignIns: lock ? 0 : failed, lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() : member.lockedUntil },
      overrideAccess: true,
    });
    return { ok: false, error: SIGN_IN_FAILED };
  }
  const updated = (await payload.update({
    collection: "members",
    id: member.id,
    data: { failedSignIns: 0, lockedUntil: null, lastSignInAt: now.toISOString() },
    overrideAccess: true,
    showHiddenFields: true,
  })) as Member;
  return { ok: true, member: view(updated) };
}

/** Ends every session of this member (signing out everywhere). */
export async function endAllSessions(payload: Payload, memberId: number): Promise<void> {
  const m = (await payload.findByID({ collection: "members", id: memberId, depth: 0, overrideAccess: true, showHiddenFields: true }).catch(() => null)) as Member | null;
  if (!m) return;
  await payload.update({ collection: "members", id: memberId, data: { sessionVersion: Number(m.sessionVersion ?? 0) + 1 }, overrideAccess: true });
}

// ---------------------------------------------------------------- password reset

export const RESET_SENT = "If there's an account with that email, we've sent it a link to choose a new password. The link works for an hour.";

/**
 * Emails a reset link when the address has an open account. The answer is the same either way. The
 * link needs the site's address (NEXT_PUBLIC_SITE_URL); away from the live store it falls back to the
 * local development address.
 */
export async function startPasswordReset(payload: Payload, form: Record<string, unknown>, env: EnvLike = process.env, now: Date = new Date()): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const email = normaliseEmail(form.email);
  if (!looksLikeEmail(email)) return { ok: false, error: "Please enter a valid email address." };
  const member = await findByEmail(payload, email);
  if (!member || member.status !== "active") return { ok: true, message: RESET_SENT };
  const base = siteUrl(env) ?? (isPreviewEnv(env) ? "http://localhost:3000" : null);
  if (!base) {
    console.error("[rewards] password reset not sent: NEXT_PUBLIC_SITE_URL is not set");
    return { ok: true, message: RESET_SENT };
  }
  const token = newResetToken();
  await payload.update({
    collection: "members",
    id: member.id,
    data: { resetTokenHash: hashResetToken(token), resetExpiresAt: new Date(now.getTime() + RESET_MINUTES * 60_000).toISOString() },
    overrideAccess: true,
  });
  const store = (await payload.findGlobal({ slug: "store-settings", depth: 0, overrideAccess: true })) as StoreSetting;
  const config = await loadRewardsConfig(payload);
  const { from, replyTo } = senderFor(env, store);
  const rendered = memberPasswordReset({
    name: member.name,
    programName: config.programName,
    link: `${base}/account/reset?token=${encodeURIComponent(token)}`,
    minutes: RESET_MINUTES,
    store: { name: store.name, street: store.street, locality: store.locality, phone: store.phone, email: store.email },
  });
  await sendEmail(payload, { ...rendered, to: member.email, from, replyTo, label: "member_password_reset", ref: `member ${member.id}` });
  return { ok: true, message: RESET_SENT };
}

export const RESET_LINK_INVALID = "This link has expired or was already used. Please ask for a new one.";

/** Sets a new password from a reset link. Ends every other session and clears any lock. */
export async function finishPasswordReset(payload: Payload, form: Record<string, unknown>, now: Date = new Date()): Promise<SignInResult> {
  const token = String(form.token ?? "");
  if (!/^[\w-]{20,100}$/.test(token)) return { ok: false, error: RESET_LINK_INVALID };
  const { docs } = await payload.find({ collection: "members", where: { resetTokenHash: { equals: hashResetToken(token) } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true });
  const member = docs[0] as Member | undefined;
  if (!member || member.status !== "active" || !member.resetExpiresAt || new Date(member.resetExpiresAt).getTime() <= now.getTime()) return { ok: false, error: RESET_LINK_INVALID };
  const password = String(form.password ?? "");
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };
  const updated = (await payload.update({
    collection: "members",
    id: member.id,
    data: {
      passwordHash: await hashPassword(password),
      sessionVersion: Number(member.sessionVersion ?? 0) + 1,
      resetTokenHash: null,
      resetExpiresAt: null,
      failedSignIns: 0,
      lockedUntil: null,
      lastSignInAt: now.toISOString(),
    },
    overrideAccess: true,
    showHiddenFields: true,
  })) as Member;
  return { ok: true, member: view(updated) };
}

// ---------------------------------------------------------------- account page

export type HistoryRow = { id: number; date: string; kind: EntryKind; label: string; points: number; reference: string | null };

/** The member's points history, newest first. Staff notes are not shown. */
export async function memberHistory(payload: Payload, memberId: number, limit = 25): Promise<HistoryRow[]> {
  const { docs } = await payload.find({ collection: "reward-entries", where: { member: { equals: memberId } }, sort: "-id", limit, depth: 0, overrideAccess: true });
  return docs.map((d) => ({ id: d.id, date: d.createdAt, kind: d.kind as EntryKind, label: ENTRY_LABELS[d.kind as EntryKind] ?? d.kind, points: d.points, reference: d.reference ?? null }));
}

export type MemberOrderRow = { number: string; date: string; totalCents: number; status: string };

const ORDER_STATUS: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  staff_review: "Being checked",
  preparing: "Being prepared",
  ready: "Ready for pickup",
  completed: "Picked up",
  canceled: "Canceled",
};

/** The member's paid or refunded shop orders, newest first (no private links: those are in the confirmation emails). */
export async function memberOrders(payload: Payload, memberId: number, limit = 10): Promise<MemberOrderRow[]> {
  const { docs } = await payload.find({
    collection: "orders",
    where: { and: [{ "rewards.member": { equals: memberId } }, { paymentStatus: { in: ["paid", "refunded"] } }] },
    sort: "-createdAt",
    limit,
    depth: 0,
    overrideAccess: true,
  });
  return docs.map((o) => ({
    number: o.number,
    date: o.createdAt,
    totalCents: o.totals.totalCents,
    status: o.paymentStatus === "refunded" ? "Refunded" : (ORDER_STATUS[o.fulfillmentStatus] ?? o.fulfillmentStatus),
  }));
}

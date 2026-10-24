"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { echoFormValues, type FormState } from "@/src/lib/checkout/form-state";
import { TOO_MANY_ATTEMPTS } from "@/src/lib/rate-limit";
import { isRateLimited } from "@/src/lib/rate-limit-server";
import { endAllSessions, finishPasswordReset, joinMember, signIn, startPasswordReset } from "@/src/lib/rewards/members";
import { currentMember, endMemberSession, rewardsPayload, startMemberSession } from "@/src/lib/rewards/session";

const CLOSED = "Rewards accounts aren't open right now.";

/** Only the member's own entries are echoed after an error, never a password (A13). */
const failed = (error: string, form: FormData, fields: string[] = ["name", "email", "phone", "next"]): FormState => ({ error, values: echoFormValues(form, fields) });

/** Where to go after signing in: a path on this site only. */
function nextPath(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : "";
  return /^\/(?![/\\])[\w\-/?=&.%]*$/.test(path) && path.length < 200 ? path : "/account";
}

export async function joinAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (await isRateLimited("memberJoin")) return failed(TOO_MANY_ATTEMPTS, form);
  const { payload, program, state } = await rewardsPayload();
  if (!state.active) return failed(CLOSED, form);
  const result = await joinMember(payload, Object.fromEntries(form), program);
  if (!result.ok) return failed(result.error, form);
  await startMemberSession(result.member);
  revalidatePath("/", "layout");
  redirect(nextPath(form.get("next")));
}

export async function signInAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (await isRateLimited("memberSignIn")) return failed(TOO_MANY_ATTEMPTS, form, ["email", "next"]);
  const { payload, state } = await rewardsPayload();
  if (!state.active) return failed(CLOSED, form, ["email", "next"]);
  const result = await signIn(payload, Object.fromEntries(form));
  if (!result.ok) return failed(result.error, form, ["email", "next"]);
  await startMemberSession(result.member);
  revalidatePath("/", "layout");
  redirect(nextPath(form.get("next")));
}

export async function signOutAction(): Promise<void> {
  await endMemberSession();
  revalidatePath("/", "layout");
  redirect("/account");
}

/** Signs out on every device: a lost phone, or a shared computer left signed in. */
export async function signOutEverywhereAction(): Promise<void> {
  const ctx = await rewardsPayload();
  const member = await currentMember(ctx);
  if (member) await endAllSessions(ctx.payload, member.id);
  await endMemberSession();
  revalidatePath("/", "layout");
  redirect("/account");
}

export async function forgotAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (await isRateLimited("memberReset")) return failed(TOO_MANY_ATTEMPTS, form, ["email"]);
  const { payload, state } = await rewardsPayload();
  if (!state.active) return failed(CLOSED, form, ["email"]);
  const result = await startPasswordReset(payload, Object.fromEntries(form));
  if (!result.ok) return failed(result.error, form, ["email"]);
  redirect("/account/forgot?sent=1");
}

export async function resetAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (await isRateLimited("memberReset")) return failed(TOO_MANY_ATTEMPTS, form, ["token"]);
  const { payload, state } = await rewardsPayload();
  if (!state.active) return failed(CLOSED, form, ["token"]);
  const result = await finishPasswordReset(payload, Object.fromEntries(form));
  if (!result.ok) return failed(result.error, form, ["token"]);
  await startMemberSession(result.member);
  revalidatePath("/", "layout");
  redirect("/account");
}

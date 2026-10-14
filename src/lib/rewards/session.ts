import "server-only";

import config from "@payload-config";
import { cookies } from "next/headers";
import { getPayload } from "payload";

import { issueSession, readSession, SESSION_DAYS } from "./credentials";
import { loadRewardsConfig, memberForSession, type MemberView } from "./members";
import { rewardsState, type RewardsConfig, type RewardsState } from "./program";

/** The member's session cookie (D45): signed, httpOnly, separate from the bag and from the staff admin's cookie. */
const MEMBER = "sp_member";
const secure = process.env.NODE_ENV === "production";

export async function rewardsPayload() {
  const payload = await getPayload({ config });
  const program = await loadRewardsConfig(payload);
  return { payload, program, state: rewardsState(program) };
}

export async function startMemberSession(member: Pick<MemberView, "id" | "sessionVersion">): Promise<void> {
  (await cookies()).set(MEMBER, issueSession(member.id, member.sessionVersion, new Date()), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endMemberSession(): Promise<void> {
  (await cookies()).delete(MEMBER);
}

/** The signed-in member, or null. Always null while the program is off, whatever the cookie says. */
export async function currentMember(ctx?: { payload: Awaited<ReturnType<typeof getPayload>>; program: RewardsConfig; state: RewardsState }): Promise<MemberView | null> {
  const { payload, state } = ctx ?? (await rewardsPayload());
  if (!state.active) return null;
  return memberForSession(payload, readSession((await cookies()).get(MEMBER)?.value, new Date()));
}

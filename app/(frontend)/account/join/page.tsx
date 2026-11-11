import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ComingSoon } from "@/components/ComingSoon";
import { JoinForm } from "@/components/rewards/MemberForms";
import { DraftNotice, EarnRate } from "@/components/rewards/Program";
import { formatPoints } from "@/src/lib/rewards/program";
import { currentMember, rewardsPayload } from "@/src/lib/rewards/session";

export const metadata: Metadata = { title: "Join rewards", robots: { index: false } };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const ctx = await rewardsPayload();
  const { program, state } = ctx;
  if (!state.active) {
    return (
      <ComingSoon title="Rewards">
        <p>A rewards program for our regulars is coming soon.</p>
      </ComingSoon>
    );
  }
  if (await currentMember(ctx)) redirect("/account");
  const raw = (await searchParams).next;
  const next = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;

  return (
    <div className="mx-auto w-[min(100%-2rem,28rem)]">
      {state.draft && <DraftNotice />}
      <h1 className="mb-2 text-[clamp(1.75rem,5vw,2.5rem)]">Join {program.programName}</h1>
      <div className="mb-6">
        <EarnRate program={program} />
        {program.welcomePoints > 0 && <p className="mt-2">You start with {formatPoints(program.welcomePoints)}.</p>}
      </div>
      <JoinForm next={next} programName={program.programName} />
      <p className="mt-6 border-t border-line pt-6">
        Already a member? <Link href={next ? `/account?next=${encodeURIComponent(next)}` : "/account"}>Sign in</Link>.
      </p>
    </div>
  );
}

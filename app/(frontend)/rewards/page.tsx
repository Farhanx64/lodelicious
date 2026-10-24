import type { Metadata } from "next";
import Link from "next/link";

import { ComingSoon } from "@/components/ComingSoon";
import { primaryButton, secondaryButton } from "@/components/checkout/styles";
import { DraftNotice, EarnRate, RewardList, Terms } from "@/components/rewards/Program";
import { formatPoints } from "@/src/lib/rewards/program";
import { currentMember, rewardsPayload } from "@/src/lib/rewards/session";

export async function generateMetadata(): Promise<Metadata> {
  const { program, state } = await rewardsPayload();
  return {
    title: state.active ? program.programName : "Rewards",
    // Only an approved program is for search engines.
    robots: state.active && !state.draft ? undefined : { index: false },
  };
}

export default async function RewardsPage() {
  const ctx = await rewardsPayload();
  const { program, state } = ctx;
  if (!state.active) {
    return (
      <ComingSoon title="Rewards">
        <p>A rewards program for our regulars is coming soon.</p>
      </ComingSoon>
    );
  }
  const member = await currentMember(ctx);

  return (
    <div className="mx-auto w-[min(100%-2rem,44rem)]">
      {state.draft && <DraftNotice />}
      <h1 className="mb-4 text-[clamp(1.75rem,5vw,2.5rem)]">{program.programName}</h1>
      <section aria-labelledby="how" className="mb-8">
        <h2 id="how" className="mb-3 text-2xl">
          How it works
        </h2>
        <ol className="mb-4 list-decimal space-y-2 pl-6">
          <li>Create a free account{program.welcomePoints > 0 ? ` and start with ${formatPoints(program.welcomePoints)}` : ""}.</li>
          <li>
            Sign in before you check out. <EarnRate program={program} />
          </li>
          <li>Spend your points at checkout for money off a shop order, taken off before tax. One reward per order.</li>
        </ol>
        <p className="text-sm text-ink-soft">
          Points are for online orders placed while signed in. If a payment doesn&rsquo;t go through, the points you used come back. If an order is refunded,
          the points it earned are taken back and the points it used are returned.
        </p>
      </section>
      <section aria-labelledby="rewards" className="mb-8">
        <h2 id="rewards" className="mb-3 text-2xl">
          Rewards
        </h2>
        <RewardList program={program} balance={member?.pointsBalance} />
      </section>
      <p className="mb-10 flex flex-wrap gap-3">
        {member ? (
          <Link href="/account" className={primaryButton}>
            Your points: {member.pointsBalance.toLocaleString("en-US")}
          </Link>
        ) : (
          <>
            <Link href="/account/join" className={primaryButton}>
              Join {program.programName}
            </Link>
            <Link href="/account" className={secondaryButton}>
              Sign in
            </Link>
          </>
        )}
      </p>
      <section id="terms" aria-labelledby="terms-title" className="border-t border-line pt-6">
        <h2 id="terms-title" className="mb-3 text-2xl">
          Terms
        </h2>
        {program.terms ? <Terms text={program.terms} /> : <p className="text-ink-soft">The terms are being written.</p>}
      </section>
    </div>
  );
}

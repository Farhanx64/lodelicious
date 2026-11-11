import type { Metadata } from "next";
import Link from "next/link";

import { ComingSoon } from "@/components/ComingSoon";
import { secondaryButton } from "@/components/checkout/styles";
import { SignInForm } from "@/components/rewards/MemberForms";
import { DraftNotice, RewardList } from "@/components/rewards/Program";
import { formatCents } from "@/src/lib/money";
import { memberHistory, memberOrders } from "@/src/lib/rewards/members";
import { formatPoints, nextReward } from "@/src/lib/rewards/program";
import { currentMember, rewardsPayload } from "@/src/lib/rewards/session";

import { signOutAction, signOutEverywhereAction } from "./actions";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const ctx = await rewardsPayload();
  const { payload, program, state } = ctx;
  if (!state.active) {
    return (
      <ComingSoon title="Your account">
        <p>Customer accounts are coming soon. You won&rsquo;t need one to order.</p>
      </ComingSoon>
    );
  }
  const member = await currentMember(ctx);
  const raw = (await searchParams).next;
  const next = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;

  if (!member) {
    return (
      <div className="mx-auto w-[min(100%-2rem,28rem)]">
        {state.draft && <DraftNotice />}
        <h1 className="mb-2 text-[clamp(1.75rem,5vw,2.5rem)]">Sign in</h1>
        <p className="mb-6">
          Sign in to your {program.programName} account to see your points and use them at checkout. You don&rsquo;t need an account to order.
        </p>
        <SignInForm next={next} />
        <p className="mt-6 border-t border-line pt-6">
          New here?{" "}
          <Link href={next ? `/account/join?next=${encodeURIComponent(next)}` : "/account/join"}>Create a free account</Link> and start earning points.{" "}
          <Link href="/rewards">How {program.programName} works</Link>.
        </p>
      </div>
    );
  }

  const [history, orders] = await Promise.all([memberHistory(payload, member.id), memberOrders(payload, member.id)]);
  const upcoming = nextReward(program.options, member.pointsBalance);

  return (
    <div className="mx-auto w-[min(100%-2rem,44rem)]">
      {state.draft && <DraftNotice />}
      <h1 className="mb-2 text-[clamp(1.75rem,5vw,2.5rem)]">Hi, {member.name.split(" ")[0]}</h1>
      <p className="mb-6 text-ink-soft">{member.email}</p>

      <section aria-labelledby="points" className="mb-8 border border-gold bg-paper p-5">
        <h2 id="points" className="mb-1 text-xl">
          Your points
        </h2>
        <p className="mb-2 font-display text-4xl text-gold-text">{member.pointsBalance.toLocaleString("en-US")}</p>
        {upcoming ? (
          <p>
            {formatPoints(upcoming.pointsToGo)} to go until {formatCents(upcoming.option.discountCents)} off.
          </p>
        ) : (
          <p>You can use any reward. Choose one at checkout.</p>
        )}
      </section>

      <section aria-labelledby="rewards" className="mb-8">
        <h2 id="rewards" className="mb-3 text-2xl">
          Rewards
        </h2>
        <RewardList program={program} balance={member.pointsBalance} />
        <p className="mt-3 text-sm">
          <Link href="/rewards">How {program.programName} works</Link>
        </p>
      </section>

      <section aria-labelledby="history" className="mb-8">
        <h2 id="history" className="mb-3 text-2xl">
          Points history
        </h2>
        {history.length === 0 ? (
          <p>No points yet. Sign in before you check out and they&rsquo;ll appear here once your order is paid.</p>
        ) : (
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Your points history, newest first</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Date
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  What
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-line align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{date(h.date)}</td>
                  <td className="py-2 pr-3">
                    {h.label}
                    {h.reference && h.kind !== "adjust" && <span className="block text-sm text-ink-soft">{h.reference}</span>}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">{h.points > 0 ? `+${h.points.toLocaleString("en-US")}` : h.points.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {orders.length > 0 && (
        <section aria-labelledby="orders" className="mb-8">
          <h2 id="orders" className="mb-3 text-2xl">
            Recent orders
          </h2>
          <ul className="divide-y divide-line border-y border-line">
            {orders.map((o) => (
              <li key={o.number} className="flex flex-wrap justify-between gap-2 py-3">
                <span>
                  <strong>{o.number}</strong> <span className="text-ink-soft">· {date(o.date)}</span>
                </span>
                <span>
                  {o.status} · {formatCents(o.totalCents)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-ink-soft">Each order&rsquo;s details are in its confirmation email.</p>
        </section>
      )}

      <div className="flex flex-wrap gap-3 border-t border-line pt-6">
        <form action={signOutAction}>
          <button type="submit" className={secondaryButton}>
            Sign out
          </button>
        </form>
        <form action={signOutEverywhereAction}>
          <button type="submit" className={secondaryButton}>
            Sign out on all devices
          </button>
        </form>
      </div>
      <p className="mt-4 text-sm text-ink-soft">To change your name, phone or email, or to close your account, contact the shop.</p>
    </div>
  );
}

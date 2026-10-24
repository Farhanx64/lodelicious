import type { Metadata } from "next";
import Link from "next/link";

import { ComingSoon } from "@/components/ComingSoon";
import { ResetForm } from "@/components/rewards/MemberForms";
import { singleParam } from "@/src/lib/checkout/token-param";
import { rewardsPayload } from "@/src/lib/rewards/session";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { state } = await rewardsPayload();
  if (!state.active) {
    return (
      <ComingSoon title="Your account">
        <p>Customer accounts are coming soon.</p>
      </ComingSoon>
    );
  }
  const token = singleParam((await searchParams).token) ?? "";
  return (
    <div className="mx-auto w-[min(100%-2rem,28rem)]">
      <h1 className="mb-4 text-[clamp(1.75rem,5vw,2.5rem)]">Choose a new password</h1>
      {token ? (
        <>
          <p className="mb-6">Choosing a new password signs you out everywhere else.</p>
          <ResetForm token={token} />
        </>
      ) : (
        <p className="mb-6">
          This link isn&rsquo;t complete. <Link href="/account/forgot">Ask for a new one</Link>.
        </p>
      )}
    </div>
  );
}

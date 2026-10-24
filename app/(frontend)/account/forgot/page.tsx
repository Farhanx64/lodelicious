import type { Metadata } from "next";
import Link from "next/link";

import { ComingSoon } from "@/components/ComingSoon";
import { ForgotForm } from "@/components/rewards/MemberForms";
import { RESET_SENT } from "@/src/lib/rewards/members";
import { rewardsPayload } from "@/src/lib/rewards/session";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ sent?: string | string[] }> }) {
  const { state } = await rewardsPayload();
  if (!state.active) {
    return (
      <ComingSoon title="Your account">
        <p>Customer accounts are coming soon.</p>
      </ComingSoon>
    );
  }
  const sent = (await searchParams).sent === "1";
  return (
    <div className="mx-auto w-[min(100%-2rem,28rem)]">
      <h1 className="mb-4 text-[clamp(1.75rem,5vw,2.5rem)]">Reset your password</h1>
      {sent ? (
        <p role="status" className="mb-6 border-l-4 border-gold bg-paper p-4">
          {RESET_SENT}
        </p>
      ) : (
        <>
          <p className="mb-6">Enter the email you joined with and we&rsquo;ll send you a link to choose a new password.</p>
          <ForgotForm />
        </>
      )}
      <p className="mt-6">
        <Link href="/account">Back to sign in</Link>
      </p>
    </div>
  );
}

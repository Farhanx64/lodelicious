import type { Metadata } from "next";
import Link from "next/link";

import { ComingSoon } from "@/components/ComingSoon";
import { ForgotForm } from "@/components/rewards/MemberForms";
import { RESET_SENT } from "@/src/lib/rewards/members";
import { rewardsPayload } from "@/src/lib/rewards/session";
import { Accent } from "@/components/ui/Accent";

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
    <div className="shell page max-w-[34rem]">
      <h1 className="mb-6">
        <Accent text="Reset your password" />
      </h1>
      {sent ? (
        <p role="status" className="mb-6 note">
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

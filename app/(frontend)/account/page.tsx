import type { Metadata } from "next";

import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default function AccountPage() {
  return (
    <ComingSoon title="Your account">
      <p>Customer accounts are coming soon. You won&rsquo;t need one to order.</p>
    </ComingSoon>
  );
}

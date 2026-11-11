import type { Metadata } from "next";
import Link from "next/link";

import { primaryButton, secondaryButton } from "@/components/checkout/styles";
import { Accent } from "@/components/ui/Accent";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

/**
 * Shown when a storefront page calls notFound(): an unknown product or policy, or an order or
 * reservation link that is wrong or mangled (A16). It reads nothing from the database, so it
 * works even when the page that threw was failing for a data reason.
 */
export default function StorefrontNotFound() {
  return (
    <div className="shell page max-w-[44rem] flex flex-col items-center text-center">
      <h1 className="mb-6">
        <Accent text="We can’t find that page" />
      </h1>
      <p className="mb-2 text-lg">The link may be old or mistyped.</p>
      <p className="mb-6">
        If you were trying to open an order or reservation receipt, check that you copied the whole link. Otherwise{" "}
        <Link href="/contact">contact us</Link> and we&rsquo;ll help.
      </p>
      <p className="flex flex-wrap justify-center gap-3">
        <Link href="/shop" className={primaryButton}>
          Shop sweets
        </Link>
        <Link href="/" className={secondaryButton}>
          Back to home
        </Link>
      </p>
    </div>
  );
}

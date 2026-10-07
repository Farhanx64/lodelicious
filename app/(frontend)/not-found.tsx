import type { Metadata } from "next";
import Link from "next/link";

import { Bow } from "@/components/brand/Bow";
import { primaryButton, secondaryButton } from "@/components/checkout/styles";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

/**
 * Shown when a storefront page calls notFound(): an unknown product or policy, or an order or
 * reservation link that is wrong or mangled (A16). It reads nothing from the database, so it
 * works even when the page that threw was failing for a data reason.
 */
export default function StorefrontNotFound() {
  return (
    <div className="mx-auto flex w-[min(100%-2rem,40rem)] flex-col items-center py-10 text-center">
      <Bow className="mb-4 w-14 text-gold" />
      <h1 className="mb-4 text-[clamp(1.75rem,5vw,2.5rem)]">We can&rsquo;t find that page</h1>
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

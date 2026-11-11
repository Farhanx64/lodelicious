"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { primaryButton, secondaryButton } from "@/components/checkout/styles";
import { Accent } from "@/components/ui/Accent";

/**
 * The storefront's error page (A16). It replaces Next's unbranded error screen for anything that
 * throws while a page renders. It never shows the error's message (it can name internals); the
 * digest is a short reference that matches the server log. Next 16 calls the recovery function
 * `retry`.
 */
export default function StorefrontError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    console.error(error);
    // Move focus to the message so a keyboard or screen reader user lands on it.
    heading.current?.focus();
  }, [error]);

  return (
    <div className="shell page max-w-[44rem] flex flex-col items-center text-center">
      <h1 ref={heading} tabIndex={-1} className="mb-6 outline-offset-4">
        <Accent text="Something went wrong" />
      </h1>
      <p className="mb-2 text-lg">We couldn&rsquo;t show this page.</p>
      <p className="mb-6">
        Please try again. If it keeps happening, <Link href="/contact">contact us</Link> and we&rsquo;ll help.
      </p>
      <p className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className={primaryButton}>
          Try again
        </button>
        <Link href="/shop" className={secondaryButton}>
          Continue shopping
        </Link>
      </p>
      {error.digest && <p className="mt-6 text-sm text-muted">Reference: {error.digest}</p>}
    </div>
  );
}

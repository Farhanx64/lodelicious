"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { Bow } from "@/components/brand/Bow";
import { primaryButton, secondaryButton } from "@/components/checkout/styles";

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
    <div className="mx-auto flex w-[min(100%-2rem,40rem)] flex-col items-center py-10 text-center">
      <Bow className="mb-4 w-14 text-gold" />
      <h1 ref={heading} tabIndex={-1} className="mb-4 text-[clamp(1.75rem,5vw,2.5rem)] outline-offset-4">
        Something went wrong
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
      {error.digest && <p className="mt-6 text-sm text-ink-soft">Reference: {error.digest}</p>}
    </div>
  );
}

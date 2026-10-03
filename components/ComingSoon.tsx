import Link from "next/link";

import { Bow } from "@/components/brand/Bow";

/** Shared page for header icons whose feature isn't built yet (accounts, wishlist, cart). */
export function ComingSoon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-[min(100%-2rem,40rem)] flex-col items-center py-10 text-center">
      <Bow className="mb-4 w-14 text-gold" />
      <h1 className="mb-4 text-[clamp(1.75rem,5vw,2.5rem)]">{title}</h1>
      <div className="mb-6 text-lg">{children}</div>
      <Link href="/shop" className="caps inline-flex min-h-11 items-center border border-gold-text px-7 text-[0.75rem] text-gold-text no-underline">
        Continue shopping
      </Link>
    </div>
  );
}

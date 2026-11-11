import Link from "next/link";

import { secondaryButton } from "@/components/checkout/styles";
import { Accent } from "@/components/ui/Accent";


/** Shared page for header icons whose feature isn't built yet (accounts, wishlist, cart). */
export function ComingSoon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="shell page max-w-[44rem] flex flex-col items-center text-center">
      <h1 className="mb-6">
        <Accent text={title} />
      </h1>
      <div className="mb-8 text-muted">{children}</div>
      <Link href="/shop" className={secondaryButton}>
        Continue shopping
      </Link>
    </div>
  );
}

import type { Metadata } from "next";

import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default function WishlistPage() {
  return (
    <ComingSoon title="Wishlist">
      <p>Saving favorites is coming soon. In the meantime, browse the shop or build a custom basket.</p>
    </ComingSoon>
  );
}

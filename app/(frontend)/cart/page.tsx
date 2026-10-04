import type { Metadata } from "next";

import { ComingSoon } from "@/components/ComingSoon";
import { telHref } from "@/src/lib/phone";
import { getStoreSettings } from "@/src/lib/store";

export const metadata: Metadata = { title: "Shopping bag", robots: { index: false } };

export default async function CartPage() {
  const store = await getStoreSettings();
  return (
    <ComingSoon title="Shopping bag">
      <p>
        Online checkout is coming soon. To order today, call <a href={telHref(store.phone)}>{store.phone}</a> or visit us at{" "}
        {store.street}, {store.locality}.
      </p>
    </ComingSoon>
  );
}

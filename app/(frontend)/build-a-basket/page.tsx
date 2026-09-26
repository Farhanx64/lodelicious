import config from "@payload-config";
import type { Metadata } from "next";
import { getPayload } from "payload";

import { BasketBuilder } from "@/components/builder/BasketBuilder";
import { loadBuilderCatalog } from "@/src/lib/catalog/builder-data";
import { telHref } from "@/src/lib/phone";
import { getStoreSettings } from "@/src/lib/store";

export const metadata: Metadata = {
  title: "Build a Basket",
  description: "Choose a size and fill a custom gift basket with chocolates, fudge and treats from our Plymouth shop.",
};

export default async function BuildABasketPage() {
  const payload = await getPayload({ config });
  const [catalog, store, rules] = await Promise.all([
    loadBuilderCatalog(),
    getStoreSettings(),
    payload.findGlobal({ slug: "gift-builder-settings", depth: 0, overrideAccess: false }),
  ]);

  return (
    <div className="mx-auto w-[min(100%-2rem,72rem)]">
      <h1 className="mb-2 text-[clamp(2.25rem,5vw,3.25rem)]">Build a Basket</h1>
      <p className="mb-8 max-w-[68ch] text-ink-soft">
        Pick a gift type and size, set a budget if you like, and fill it with favorites from our shelves. We&rsquo;ll wrap it by hand.
      </p>
      <BasketBuilder
        settings={catalog.settings}
        products={catalog.products}
        display={catalog.display}
        budgetNotice={rules.budgetNotice}
        previewStock={catalog.previewStock}
        phone={store.phone}
        phoneHref={telHref(store.phone)}
      />
    </div>
  );
}

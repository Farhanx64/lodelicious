import config from "@payload-config";
import type { Metadata } from "next";
import Link from "next/link";
import { getPayload } from "payload";

import { BasketBuilder } from "@/components/builder/BasketBuilder";
import { secondaryButton } from "@/components/checkout/styles";
import { loadBuilderCatalog } from "@/src/lib/catalog/builder-data";
import { contactHref, topicForPresentation, type ContactTopic } from "@/src/lib/inquiries/shared";
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

  // Special presentations that can't be bought online yet (Cowboy, Baby White, filled ceramics) are
  // arranged by inquiry (D37): one link per topic.
  const byInquiry = new Map<ContactTopic, string>();
  for (const p of rules.specialPresentations ?? []) {
    const topic = topicForPresentation(p.code);
    if (p.status === "inquiry" && topic && !byInquiry.has(topic)) byInquiry.set(topic, p.name);
  }

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
      {byInquiry.size > 0 && (
        <section aria-labelledby="made-to-order" className="mt-12 border border-gold bg-paper p-6">
          <h2 id="made-to-order" className="mb-3 text-2xl">
            Looking for something special?
          </h2>
          <p className="mb-4 max-w-[68ch]">These baskets are made to order, so we arrange them with you directly.</p>
          <ul className="flex flex-wrap gap-3">
            {[...byInquiry].map(([topic, name]) => (
              <li key={topic}>
                <Link href={contactHref({ topic })} className={secondaryButton}>
                  Ask about the {name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

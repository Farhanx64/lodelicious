import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/catalog/ProductCard";
import { primaryButton, secondaryButton } from "@/components/checkout/styles";
import { GIFT_BASKET_CATEGORY, groupGiftBaskets } from "@/src/lib/catalog/gift-baskets";
import { listProducts } from "@/src/lib/catalog/queries";
import { telHref } from "@/src/lib/phone";
import { getStoreSettings } from "@/src/lib/store";

export const metadata: Metadata = {
  title: "Gift Baskets",
  description: "Ready-made gift baskets assembled by hand in our Plymouth shop. The price includes the basket and presentation.",
};

export default async function GiftBasketsPage() {
  const [products, store] = await Promise.all([listProducts({ category: GIFT_BASKET_CATEGORY }), getStoreSettings()]);
  const groups = groupGiftBaskets(products);
  // Each card carries its own availability label; this note only explains the inquiry-only ones.
  const inquiryOnly = products.filter((p) => p.channel === "inquiry_only").length;
  const inquiryNote =
    inquiryOnly === 0
      ? null
      : inquiryOnly === products.length
        ? "Curated baskets are available by inquiry for now."
        : "Baskets marked “Available by inquiry” are ordered by asking us.";

  return (
    <div className="mx-auto w-[min(100%-2rem,72rem)]">
      <h1 className="mb-2 text-[clamp(2.25rem,5vw,3.25rem)]">Gift Baskets</h1>
      <p className="mb-4 max-w-[68ch] text-ink-soft">
        Our curated baskets are assembled by hand in our Plymouth shop. The price of a curated basket already includes
        the basket and its presentation, with nothing added for packaging.
      </p>
      <div className="mb-10 max-w-[68ch] border-l-4 border-gold bg-paper p-4">
        <p className="mb-2">
          {inquiryNote && `${inquiryNote} `}
          Contents vary with availability, so ask us what is in the baskets right now: call{" "}
          <a href={telHref(store.phone)}>{store.phone}</a>, visit us at {store.street}, {store.locality}, or{" "}
          <Link href="/contact?topic=gift_basket">send us a message about a gift basket</Link>.
        </p>
        <p>Please tell us about any allergy or dietary request when you get in touch.</p>
        {store.allergyNotice && <p className="mt-2 text-sm text-ink-soft">{store.allergyNotice}</p>}
      </div>

      {groups.length === 0 ? (
        <div className="mb-12 border border-line bg-paper p-6">
          <p className="mb-2 font-semibold">Our gift baskets will be listed here soon.</p>
          <p>
            In the meantime, call <a href={telHref(store.phone)}>{store.phone}</a> or{" "}
            <Link href="/contact?topic=gift_basket">send us a message</Link> and we will help you choose, or build your
            own basket below.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-labelledby={`group-${group.key}`} className="mb-12">
            <h2 id={`group-${group.key}`} className="mb-2 text-3xl">
              {group.title}
            </h2>
            {group.blurb && <p className="mb-6 max-w-[68ch]">{group.blurb}</p>}
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] gap-5">
              {group.products.map((p) => (
                <ProductCard key={p.id} product={p} hideUnapprovedPrice />
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <section aria-labelledby="build-your-own" className="border-t-4 border-coastal bg-coastal-pale p-5">
          <h2 id="build-your-own" className="mb-2 text-2xl">
            Build your own basket
          </h2>
          <p className="mb-4">
            Prefer to choose every item? Pick a size, set a budget if you like, and fill the basket yourself. A custom
            basket&rsquo;s total is the items you choose plus a basket and packaging fee for its size.
          </p>
          <Link href="/build-a-basket" className={primaryButton}>
            Build your own basket
          </Link>
        </section>
        <section aria-labelledby="seasonal-gift-boxes" className="border-t-4 border-coastal bg-coastal-pale p-5">
          <h2 id="seasonal-gift-boxes" className="mb-2 text-2xl">
            Seasonal gift boxes
          </h2>
          <p className="mb-4">
            Our gift boxes are seasonal and by inquiry only, so there is nothing to buy online. Ask us what is
            available this season.
          </p>
          <Link href="/contact?topic=gift_box" className={secondaryButton}>
            Ask about gift boxes
          </Link>
        </section>
      </div>
    </div>
  );
}

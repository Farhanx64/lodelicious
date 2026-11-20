import type { Metadata } from "next";
import Link from "next/link";

import { primaryButton, secondaryButton } from "@/components/checkout/styles";
import { JsonLd } from "@/components/seo/JsonLd";
import { contactHref } from "@/src/lib/inquiries/shared";
import { telHref } from "@/src/lib/phone";
import { faqJsonLd } from "@/src/lib/seo";
import { getStoreSettings } from "@/src/lib/store";

export const metadata: Metadata = {
  title: { absolute: "Corporate Gift Baskets on the South Shore, MA | Lodelicious Plymouth" },
  description: "Corporate and client gift baskets from a family-owned Plymouth, MA shop: chocolates, fudge and treats for teams, clients and events. Ask us for a quote.",
  alternates: { canonical: "/corporate-gifts" },
};

export default async function CorporateGiftsPage() {
  const store = await getStoreSettings();
  const faqs = [
    { q: "Can you make several matching baskets for our team or clients?", a: "Yes. Tell us how many, your budget per basket and the date, and we'll put together a quote." },
    { q: "Can you ship baskets to clients in other states?", a: "Yes, anywhere in the US. Shipping is priced from each ZIP code." },
    { q: "Can we include our own card or message?", a: "Yes. Send us the message for each basket when you order." },
  ];
  return (
    <div className="mx-auto w-[min(100%-2rem,60rem)]">
      <JsonLd data={faqJsonLd(faqs)} />
      <h1 className="mb-3 text-[clamp(2.25rem,5vw,3.25rem)]">Corporate Gift Baskets</h1>
      <p className="mb-6 max-w-[68ch] text-lg">
        Thank clients, welcome new hires or celebrate the holidays with gift baskets put together by hand in our Plymouth shop: Phillips chocolates,
        Cape Cod fudge and sweet and savory treats, at the budget you choose.
      </p>
      <div className="mb-10 flex flex-wrap gap-3">
        <Link href={contactHref({ topic: "gift_basket" })} className={primaryButton}>
          Ask for a quote
        </Link>
        <a href={telHref(store.phone)} className={secondaryButton}>
          Call {store.phone}
        </a>
      </div>

      <section className="mb-8 max-w-[68ch]">
        <h2 className="mb-2 text-2xl">How it works</h2>
        <ol className="list-decimal space-y-1 pl-6">
          <li>Tell us how many baskets, your budget per basket and when you need them.</li>
          <li>We suggest contents and confirm the total.</li>
          <li>Pick them up in Plymouth, or we ship them to each address.</li>
        </ol>
      </section>

      <section className="mb-10 max-w-[68ch]">
        <h2 className="mb-3 text-2xl">Corporate gift questions</h2>
        <dl className="space-y-4">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold">{f.q}</dt>
              <dd>{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="mb-12">
        Want to see sizes and prices first? <Link href="/gift-baskets">Browse our gift baskets</Link> or <Link href="/build-a-basket">build one yourself</Link>.
      </p>
    </div>
  );
}

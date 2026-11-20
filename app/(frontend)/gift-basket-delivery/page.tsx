import type { Metadata } from "next";
import Link from "next/link";

import { primaryButton } from "@/components/checkout/styles";
import { JsonLd } from "@/components/seo/JsonLd";
import { telHref } from "@/src/lib/phone";
import { faqJsonLd, SERVICE_TOWNS } from "@/src/lib/seo";
import { OCCASIONS } from "@/src/lib/seo/occasions";
import { getStoreSettings } from "@/src/lib/store";

export const metadata: Metadata = {
  title: { absolute: "Gift Basket Delivery in Plymouth & the South Shore, MA | Lodelicious" },
  description: "Gift baskets from our Manomet, Plymouth shop: pickup, local delivery through DoorDash, or shipping anywhere in the US. Serving Plymouth, Kingston, Duxbury, Carver and nearby towns.",
  alternates: { canonical: "/gift-basket-delivery" },
};

/** One genuine service-area page (not a page per town): how a basket gets from our shop to them. */
export default async function DeliveryPage() {
  const store = await getStoreSettings();
  const faqs = [
    { q: "Do you deliver gift baskets in Plymouth, MA?", a: `Yes. Local delivery is through DoorDash${store.doordashUrl ? " from our DoorDash page" : ""}, or pick up at ${store.street}, ${store.locality}.` },
    { q: "Do you ship gift baskets outside Massachusetts?", a: "Yes, anywhere in the US. Shipping is priced at checkout from the ZIP code and the weight of the order." },
    { q: "Can I pick up my order?", a: `Yes. Choose a pickup time at checkout and collect it at ${store.street}, ${store.locality}.` },
  ];

  return (
    <div className="mx-auto w-[min(100%-2rem,60rem)]">
      <JsonLd data={faqJsonLd(faqs)} />
      <h1 className="mb-3 text-[clamp(2.25rem,5vw,3.25rem)]">Gift Basket Delivery in Plymouth &amp; the South Shore</h1>
      <p className="mb-8 max-w-[68ch] text-lg">
        Every basket is put together by hand in our shop at {store.street}, {store.locality}. Here is how it gets to the person you&rsquo;re
        thinking of.
      </p>

      <div className="mb-10 grid gap-4 md:grid-cols-3">
        <section className="border border-line bg-paper p-5">
          <h2 className="mb-2 text-2xl">Pickup</h2>
          <p>Choose a pickup time at checkout and collect it at our Manomet shop.</p>
        </section>
        <section className="border border-line bg-paper p-5">
          <h2 className="mb-2 text-2xl">Local delivery</h2>
          <p>
            Delivered nearby through DoorDash
            {store.doordashUrl && (
              <>
                : <a href={store.doordashUrl}>order on DoorDash</a>
              </>
            )}
            .
          </p>
        </section>
        <section className="border border-line bg-paper p-5">
          <h2 className="mb-2 text-2xl">US shipping</h2>
          <p>Shipped anywhere in the US. The price is worked out at checkout from the ZIP code and weight.</p>
        </section>
      </div>

      <section className="mb-10 max-w-[68ch]">
        <h2 className="mb-2 text-2xl">Towns we serve</h2>
        <p className="mb-2">{SERVICE_TOWNS.join(", ")} and the rest of the South Shore, plus the Cape Cod canal towns.</p>
        <p>
          Need it on a particular day, or delivered to a funeral home or office? Call us at <a href={telHref(store.phone)}>{store.phone}</a> and we&rsquo;ll
          tell you what&rsquo;s possible.
        </p>
      </section>

      <section className="mb-10 max-w-[68ch]">
        <h2 className="mb-3 text-2xl">Delivery questions</h2>
        <dl className="space-y-4">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold">{f.q}</dt>
              <dd>{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <nav aria-label="Gift baskets by occasion" className="mb-12 border-t border-line pt-6">
        <p className="mb-2 font-semibold">Gift baskets by occasion</p>
        <ul className="mb-6 flex flex-wrap gap-3">
          {OCCASIONS.map((o) => (
            <li key={o.slug}>
              <Link href={`/gift-baskets/${o.slug}`}>{o.h1}</Link>
            </li>
          ))}
        </ul>
        <Link href="/gift-baskets" className={primaryButton}>
          See all gift baskets
        </Link>
      </nav>
    </div>
  );
}

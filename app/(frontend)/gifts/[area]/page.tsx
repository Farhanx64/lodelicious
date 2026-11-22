import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/catalog/ProductCard";
import { primaryButton, secondaryButton } from "@/components/checkout/styles";
import { FaqList } from "@/components/seo/FaqList";
import { JsonLd } from "@/components/seo/JsonLd";
import { listProducts } from "@/src/lib/catalog/queries";
import { telHref } from "@/src/lib/phone";
import { breadcrumbJsonLd, faqJsonLd } from "@/src/lib/seo";
import { AREAS, areaBySlug } from "@/src/lib/seo/areas";
import { occasionBySlug } from "@/src/lib/seo/occasions";
import { getStoreSettings } from "@/src/lib/store";

type Props = { params: Promise<{ area: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = areaBySlug((await params).area);
  if (!a) return {};
  return { title: { absolute: `${a.title} | Lodelicious` }, description: a.description, alternates: { canonical: `/gifts/${a.slug}` } };
}

/** One service-area page per area we serve (D69): how a gift gets there, local favourites, FAQs. */
export default async function AreaPage({ params }: Props) {
  const a = areaBySlug((await params).area);
  if (!a) notFound();
  const [all, store] = await Promise.all([listProducts({ limit: 500 }), getStoreSettings()]);
  const address = [store.street, store.locality].filter(Boolean).join(", ");
  const faqs = a.faqs.map((f) => ({ q: f.q, a: f.a.replaceAll("{address}", address) }));
  const favourites = all.filter((p) => a.match.test([p.title, p.brand, p.shortDescription].filter(Boolean).join(" "))).slice(0, 8);
  const occasions = a.occasions.map(occasionBySlug).filter((o): o is NonNullable<typeof o> => Boolean(o));
  const others = AREAS.filter((x) => x.slug !== a.slug);

  return (
    <div className="mx-auto w-[min(100%-2rem,72rem)]">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Delivery & shipping", path: "/gift-basket-delivery" },
            { name: a.h1, path: `/gifts/${a.slug}` },
          ]),
          faqJsonLd(faqs),
        ]}
      />
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <Link href="/gift-basket-delivery">Delivery &amp; shipping</Link> <span aria-hidden="true">/</span> {a.name}
      </nav>
      <h1 className="mb-3 text-[clamp(2.25rem,5vw,3.25rem)]">{a.h1}</h1>
      <p className="mb-4 max-w-[68ch] text-lg">{a.intro}</p>
      <p className="mb-6 max-w-[68ch] text-ink-soft">Serving {a.towns.join(", ")} and nearby.</p>
      <div className="mb-10 flex flex-wrap gap-3">
        <Link href="/gift-baskets" className={primaryButton}>
          See gift baskets
        </Link>
        <Link href="/build-a-basket" className={secondaryButton}>
          Build a basket
        </Link>
        <a href={telHref(store.phone)} className={secondaryButton}>
          Call {store.phone}
        </a>
      </div>

      <div className="mb-10 grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]">
        {a.sections.map((s) => (
          <section key={s.heading} className="border border-line bg-paper p-5">
            <h2 className="mb-2 text-2xl">{s.heading}</h2>
            <p>{s.body}</p>
          </section>
        ))}
      </div>

      {store.doordashUrl && (
        <p className="mb-10 max-w-[68ch]">
          Local delivery: <a href={store.doordashUrl}>order from us on DoorDash</a>.
        </p>
      )}

      {favourites.length > 0 && (
        <section aria-labelledby="favourites" className="mb-12">
          <h2 id="favourites" className="mb-4 text-3xl">
            Local favourites
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(10rem,100%),1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] sm:gap-5">
            {favourites.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ul>
        </section>
      )}

      <FaqList heading={`${a.name} gift questions`} faqs={faqs} />

      <nav aria-label="Gifts by occasion and area" className="mb-12 border-t border-line pt-6">
        <p className="mb-2 font-semibold">Gift baskets by occasion</p>
        <ul className="mb-6 flex flex-wrap gap-3">
          {occasions.map((o) => (
            <li key={o.slug}>
              <Link href={`/gift-baskets/${o.slug}`}>{o.h1}</Link>
            </li>
          ))}
          <li>
            <Link href="/corporate-gifts">Corporate gifts</Link>
          </li>
        </ul>
        <p className="mb-2 font-semibold">Other areas we serve</p>
        <ul className="flex flex-wrap gap-3">
          {others.map((x) => (
            <li key={x.slug}>
              <Link href={`/gifts/${x.slug}`}>{x.h1}</Link>
            </li>
          ))}
          <li>
            <Link href="/gift-basket-delivery">Delivery &amp; shipping</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

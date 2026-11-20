import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/catalog/ProductCard";
import { primaryButton, secondaryButton } from "@/components/checkout/styles";
import { JsonLd } from "@/components/seo/JsonLd";
import { GIFT_BASKET_CATEGORY } from "@/src/lib/catalog/gift-baskets";
import { listProducts } from "@/src/lib/catalog/queries";
import { telHref } from "@/src/lib/phone";
import { breadcrumbJsonLd, faqJsonLd } from "@/src/lib/seo";
import { OCCASIONS, occasionBySlug } from "@/src/lib/seo/occasions";
import { getStoreSettings } from "@/src/lib/store";

type Props = { params: Promise<{ occasion: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const o = occasionBySlug((await params).occasion);
  if (!o) return {};
  return { title: { absolute: `${o.title} | Lodelicious` }, description: o.description, alternates: { canonical: `/gift-baskets/${o.slug}` } };
}

export default async function OccasionPage({ params }: Props) {
  const o = occasionBySlug((await params).occasion);
  if (!o) notFound();
  const [baskets, all, store] = await Promise.all([listProducts({ category: GIFT_BASKET_CATEGORY }), listProducts({ limit: 500 }), getStoreSettings()]);
  const bySlug = new Map(baskets.map((p) => [p.slug, p]));
  const featured = o.basketSlugs.map((s) => bySlug.get(s)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const seen = new Set(featured.map((p) => p.id));
  const more = o.match
    ? all.filter((p) => !seen.has(p.id) && o.match!.test([p.title, p.brand, p.shortDescription].filter(Boolean).join(" "))).slice(0, 12)
    : [];
  const others = OCCASIONS.filter((x) => x.slug !== o.slug);

  return (
    <div className="mx-auto w-[min(100%-2rem,72rem)]">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Gift Baskets", path: "/gift-baskets" },
            { name: o.h1, path: `/gift-baskets/${o.slug}` },
          ]),
          faqJsonLd(o.faqs),
        ]}
      />
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <Link href="/gift-baskets">Gift Baskets</Link> <span aria-hidden="true">/</span> {o.name}
      </nav>
      <h1 className="mb-3 text-[clamp(2.25rem,5vw,3.25rem)]">{o.h1}</h1>
      <p className="mb-6 max-w-[68ch] text-lg">{o.intro}</p>
      <div className="mb-10 flex flex-wrap gap-3">
        <Link href="/build-a-basket" className={primaryButton}>
          Build a basket
        </Link>
        <a href={telHref(store.phone)} className={secondaryButton}>
          Call {store.phone}
        </a>
      </div>

      {featured.length > 0 && (
        <section aria-labelledby="baskets" className="mb-12">
          <h2 id="baskets" className="mb-4 text-3xl">
            {o.name} baskets
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(10rem,100%),1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] sm:gap-5">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ul>
        </section>
      )}
      {more.length > 0 && (
        <section aria-labelledby="more" className="mb-12">
          <h2 id="more" className="mb-4 text-3xl">
            {featured.length ? "More gift ideas" : `${o.name} gifts`}
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(10rem,100%),1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] sm:gap-5">
            {more.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ul>
        </section>
      )}

      {o.sections.map((s) => (
        <section key={s.heading} className="mb-8 max-w-[68ch]">
          <h2 className="mb-2 text-2xl">{s.heading}</h2>
          <p>{s.body}</p>
        </section>
      ))}

      <section aria-labelledby="faq" className="mb-10 max-w-[68ch]">
        <h2 id="faq" className="mb-3 text-2xl">
          {o.name} gift basket questions
        </h2>
        <dl className="space-y-4">
          {o.faqs.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold">{f.q}</dt>
              <dd>{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <nav aria-label="More occasions" className="mb-12 border-t border-line pt-6">
        <p className="mb-2 font-semibold">Gift baskets for every occasion</p>
        <ul className="flex flex-wrap gap-3">
          {others.map((x) => (
            <li key={x.slug}>
              <Link href={`/gift-baskets/${x.slug}`}>{x.h1}</Link>
            </li>
          ))}
          <li>
            <Link href="/corporate-gifts">Corporate gifts</Link>
          </li>
          <li>
            <Link href="/gift-basket-delivery">Delivery &amp; shipping</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

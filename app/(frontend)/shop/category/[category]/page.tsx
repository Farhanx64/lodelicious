import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { ProductCard } from "@/components/catalog/ProductCard";
import { primaryButton } from "@/components/checkout/styles";
import { FaqList } from "@/components/seo/FaqList";
import { JsonLd } from "@/components/seo/JsonLd";
import { listCategories, listProducts } from "@/src/lib/catalog/queries";
import { breadcrumbJsonLd, faqJsonLd, metaText } from "@/src/lib/seo";
import { CATEGORY_PAGES_ELSEWHERE, categoryCopyBySlug, categoryHref } from "@/src/lib/seo/categories";
import { occasionBySlug } from "@/src/lib/seo/occasions";

type Props = { params: Promise<{ category: string }> };

async function findCategory(slug: string) {
  return (await listCategories()).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).category;
  const category = await findCategory(slug);
  if (!category) return {};
  const copy = categoryCopyBySlug(slug);
  return {
    title: copy ? { absolute: `${copy.title} | Lodelicious` } : `${category.name} – Shop`,
    description: copy?.description ?? metaText(category.description ? `${category.description} From our gift shop in Plymouth, MA.` : null),
    alternates: { canonical: `/shop/category/${slug}` },
  };
}

/** A shop category with its own copy and FAQs (D69). Same products as /shop?category=<slug>. */
export default async function CategoryPage({ params }: Props) {
  const slug = (await params).category;
  if (CATEGORY_PAGES_ELSEWHERE[slug]) permanentRedirect(CATEGORY_PAGES_ELSEWHERE[slug]);
  const [categories, products] = await Promise.all([listCategories(), listProducts({ category: slug })]);
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();
  const copy = categoryCopyBySlug(slug);
  const occasions = (copy?.occasions ?? []).map(occasionBySlug).filter((o): o is NonNullable<typeof o> => Boolean(o));
  const faqs = copy?.faqs ?? [];

  return (
    <div className="mx-auto w-[min(100%-2rem,72rem)]">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Shop", path: "/shop" },
            { name: category.name, path: `/shop/category/${slug}` },
          ]),
          ...(faqs.length ? [faqJsonLd(faqs)] : []),
        ]}
      />
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <Link href="/shop">Shop</Link> <span aria-hidden="true">/</span> {category.name}
      </nav>
      <h1 className="mb-3 text-[clamp(2.25rem,5vw,3.25rem)]">{copy?.h1 ?? category.name}</h1>
      <p className="mb-8 max-w-[68ch] text-lg">{copy?.intro ?? category.description}</p>

      <nav aria-label="Categories" className="mb-8">
        <ul className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={categoryHref(c.slug ?? "")}
                aria-current={c.slug === slug ? "page" : undefined}
                className={`inline-flex min-h-11 items-center border px-4 no-underline ${c.slug === slug ? "border-coastal-deep bg-coastal-deep text-cream" : "border-line bg-paper text-ink"}`}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {products.length === 0 ? (
        <div className="mb-12 border border-line bg-paper p-6">
          <p className="mb-2 font-semibold">Nothing in this category is online right now.</p>
          <p>
            <Link href="/shop">See everything in the shop</Link>, or call us and we&rsquo;ll help you find it.
          </p>
        </div>
      ) : (
        <section aria-labelledby="products" className="mb-12">
          <h2 id="products" className="sr-only">
            {category.name} products
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(10rem,100%),1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] sm:gap-5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ul>
        </section>
      )}

      <FaqList heading={`${category.name} questions`} faqs={faqs} />

      <nav aria-label="Gift ideas" className="mb-12 border-t border-line pt-6">
        {occasions.length > 0 && (
          <>
            <p className="mb-2 font-semibold">Gift ideas</p>
            <ul className="mb-6 flex flex-wrap gap-3">
              {occasions.map((o) => (
                <li key={o.slug}>
                  <Link href={`/gift-baskets/${o.slug}`}>{o.h1}</Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <Link href="/build-a-basket" className={primaryButton}>
          Build a basket
        </Link>
      </nav>
    </div>
  );
}

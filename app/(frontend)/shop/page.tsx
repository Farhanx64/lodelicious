import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard, productGrid } from "@/components/catalog/ProductCard";
import { field, label, primaryButton } from "@/components/checkout/styles";
import { listCategories, listProducts } from "@/src/lib/catalog/queries";
import { Accent } from "@/components/ui/Accent";

export const metadata: Metadata = { title: "Shop" };

/** Baskets and keepsake ceramics have their own pages (/gift-baskets, /baby-gifts), so the shop list leaves them out. */
const OWN_PAGE_CATEGORIES = new Set(["baby-gifts", "gift-baskets"]);

type Props = { searchParams: Promise<{ q?: string; category?: string }> };

export default async function ShopPage({ searchParams }: Props) {
  const { q = "", category = "" } = await searchParams;
  const [allCategories, listed] = await Promise.all([listCategories(), listProducts({ q, category: category || undefined })]);
  const categories = allCategories.filter((c) => !OWN_PAGE_CATEGORIES.has(c.slug ?? ""));
  const products = category
    ? listed
    : listed.filter((p) => !OWN_PAGE_CATEGORIES.has(typeof p.category === "object" && p.category ? (p.category.slug ?? "") : ""));
  const active = allCategories.find((c) => c.slug === category);

  return (
    <div className="shell page">
      <p className="label-caps mb-4 text-rose-deep">{active ? "Shop" : "Plymouth, Massachusetts"}</p>
      <h1 className="mb-5">
        <Accent text={active ? active.name : "Shop"} />
      </h1>
      <p className="mb-10 max-w-[60ch] text-muted md:mb-14">
        {active?.description ?? "Chocolates, fudge, candy and gift add-ons from our Plymouth shop."}
      </p>

      <form role="search" action="/shop" className="mb-6 flex max-w-[44rem] flex-wrap items-end gap-3">
        {category && <input type="hidden" name="category" value={category} />}
        <div className="flex min-w-[min(100%,16rem)] flex-1 flex-col">
          <label htmlFor="shop-search" className={label}>
            Search products
          </label>
          <input
            id="shop-search"
            name="q"
            type="search"
            defaultValue={q}
            className={`${field} rounded-full! px-5!`}
          />
        </div>
        <button type="submit" className={primaryButton}>
          Search
        </button>
      </form>

      <nav aria-label="Categories" className="mb-10 border-b border-line pb-8">
        <ul className="flex flex-wrap gap-2">
          {[{ slug: "", name: "All" }, ...categories].map((c) => {
            const current = (c.slug ?? "") === category;
            const params = new URLSearchParams({ ...(c.slug ? { category: c.slug } : {}), ...(q ? { q } : {}) });
            return (
              <li key={c.slug || "all"}>
                <Link
                  href={`/shop${params.size ? `?${params}` : ""}`}
                  aria-current={current ? "page" : undefined}
                  className={`label-caps inline-flex min-h-11 items-center rounded-full border px-5 no-underline transition-colors ${current ? "border-rose-deep bg-rose-deep text-on-rose" : "border-muted/50 text-cocoa hover:border-cocoa"}`}
                >
                  {c.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p aria-live="polite" className="label-caps mb-8 text-muted">
        {products.length === 1 ? "1 product" : `${products.length} products`}
        {q && ` matching “${q}”`}
      </p>

      {products.length === 0 ? (
        <div className="panel">
          <p className="mb-2 font-medium">Nothing matches that search yet.</p>
          <p>
            <Link href="/shop">See everything in the shop</Link>, or call us and we&rsquo;ll help you find it.
          </p>
        </div>
      ) : (
        <>
          {/* The cards' titles are h3, so give them an h2 to sit under (the outline would otherwise jump from h1 to h3). */}
          <h2 className="sr-only">{active ? `${active.name} products` : "Products"}</h2>
          <ul className={productGrid}>
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

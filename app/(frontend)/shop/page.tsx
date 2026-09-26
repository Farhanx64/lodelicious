import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/catalog/ProductCard";
import { listCategories, listProducts } from "@/src/lib/catalog/queries";

export const metadata: Metadata = { title: "Shop" };

type Props = { searchParams: Promise<{ q?: string; category?: string }> };

export default async function ShopPage({ searchParams }: Props) {
  const { q = "", category = "" } = await searchParams;
  const [categories, products] = await Promise.all([listCategories(), listProducts({ q, category: category || undefined })]);
  const active = categories.find((c) => c.slug === category);

  return (
    <div className="mx-auto w-[min(100%-2rem,72rem)]">
      <h1 className="mb-2 text-[clamp(2.25rem,5vw,3.25rem)]">{active ? active.name : "Shop"}</h1>
      <p className="mb-6 max-w-[68ch] text-ink-soft">
        {active?.description ?? "Chocolates, fudge, candy and gift add-ons from our Plymouth shop."}
      </p>

      <form role="search" action="/shop" className="mb-6 flex flex-wrap items-end gap-3">
        {category && <input type="hidden" name="category" value={category} />}
        <div className="flex min-w-[min(100%,20rem)] flex-1 flex-col gap-1">
          <label htmlFor="shop-search" className="text-sm font-semibold">
            Search products
          </label>
          <input
            id="shop-search"
            name="q"
            type="search"
            defaultValue={q}
            className="min-h-11 border border-ink-soft bg-paper px-3"
          />
        </div>
        <button type="submit" className="min-h-11 bg-ink px-5 text-cream">
          Search
        </button>
      </form>

      <nav aria-label="Categories" className="mb-8">
        <ul className="flex flex-wrap gap-2">
          {[{ slug: "", name: "All" }, ...categories].map((c) => {
            const current = (c.slug ?? "") === category;
            const params = new URLSearchParams({ ...(c.slug ? { category: c.slug } : {}), ...(q ? { q } : {}) });
            return (
              <li key={c.slug || "all"}>
                <Link
                  href={`/shop${params.size ? `?${params}` : ""}`}
                  aria-current={current ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center border px-4 no-underline ${current ? "border-ink bg-ink text-cream" : "border-line bg-paper text-ink"}`}
                >
                  {c.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p aria-live="polite" className="mb-4 text-sm text-ink-soft">
        {products.length === 1 ? "1 product" : `${products.length} products`}
        {q && ` matching “${q}”`}
      </p>

      {products.length === 0 ? (
        <div className="border border-line bg-paper p-6">
          <p className="mb-2 font-semibold">Nothing matches that search yet.</p>
          <p>
            <Link href="/shop">See everything in the shop</Link>, or call us and we&rsquo;ll help you find it.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] gap-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

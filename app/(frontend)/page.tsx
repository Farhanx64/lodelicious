import Link from "next/link";

import { ProductCard } from "@/components/catalog/ProductCard";
import { listProducts } from "@/src/lib/catalog/queries";
import { telHref } from "@/src/lib/phone";
import { getStoreSettings } from "@/src/lib/store";

export default async function HomePage() {
  const [store, featured] = await Promise.all([getStoreSettings(), listProducts({ featured: true, limit: 8 })]);

  return (
    <div className="mx-auto w-[min(100%-2rem,72rem)]">
      <section className="mb-12 grid grid-cols-[minmax(0,1fr)] items-center gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <p className="mb-2 text-sm tracking-[0.18em] text-gold-text uppercase">Plymouth, Massachusetts</p>
          <h1 className="mb-4 text-[clamp(2.5rem,6vw,4rem)]">Gifts &amp; sweets, wrapped by hand</h1>
          <p className="mb-6 max-w-[60ch] text-lg">
            Gift baskets, Phillips chocolates, fudge and treats from our family shop in Plymouth. Choose from our
            favorites or ask us to build a basket around your budget.
          </p>
          <p className="flex flex-wrap gap-3">
            <Link href="/shop" className="inline-flex min-h-11 items-center bg-ink px-6 text-cream no-underline">
              Shop sweets
            </Link>
            <Link href="/baby-gifts" className="inline-flex min-h-11 items-center border border-ink px-6 text-ink no-underline">
              Baby gifts
            </Link>
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
        <img src="/brand/logo-512.png" alt="" width={360} height={360} className="mx-auto hidden w-full max-w-[360px] md:block" />
      </section>

      {featured.length > 0 && (
        <section aria-labelledby="favorites" className="mb-12">
          <h2 id="favorites" className="mb-4 text-3xl">
            Shop favorites
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] gap-5">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ul>
          <p className="mt-4">
            <Link href="/shop">See the whole shop</Link>
          </p>
        </section>
      )}

      <section aria-labelledby="get-it" className="mb-4 grid gap-4 md:grid-cols-3">
        <h2 id="get-it" className="sr-only">
          Getting your order
        </h2>
        <div className="border border-line bg-paper p-5">
          <h3 className="mb-1 text-xl">Pickup</h3>
          <p>
            Free from our shop at {store.street}, {store.locality}.
          </p>
        </div>
        <div className="border border-line bg-paper p-5">
          <h3 className="mb-1 text-xl">Local delivery</h3>
          <p>$25 within five miles of the shop — call to arrange a time.</p>
        </div>
        <div className="border border-line bg-paper p-5">
          <h3 className="mb-1 text-xl">Order by phone</h3>
          <p>
            Online checkout is coming soon. Call <a href={telHref(store.phone)}>{store.phone}</a> today.
          </p>
        </div>
      </section>
    </div>
  );
}

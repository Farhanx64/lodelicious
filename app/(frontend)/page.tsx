import Link from "next/link";

import { AwningHem } from "@/components/brand/Awning";
import { Lockup } from "@/components/brand/Lockup";
import { ProductCard } from "@/components/catalog/ProductCard";
import { PhotoStrip } from "@/components/home/PhotoStrip";
import { listProducts } from "@/src/lib/catalog/queries";
import { telHref } from "@/src/lib/phone";
import { getHomePage, getStoreSettings } from "@/src/lib/store";

const button = "caps inline-flex min-h-11 items-center px-7 text-[0.75rem] no-underline";

export default async function HomePage() {
  const [store, home, featured] = await Promise.all([getStoreSettings(), getHomePage(), listProducts({ featured: true, limit: 8 })]);

  return (
    <div className="mx-auto w-[min(100%-2rem,72rem)]">
      {/* The board's awning: ivory canopy, gold lockup, scalloped gold hem. */}
      <section aria-labelledby="welcome" className="mb-10">
        <div className="border-x border-t border-gold bg-paper px-6 pt-10 pb-8">
          <h1 id="welcome" className="sr-only">
            {store.name} — {store.tagline}
          </h1>
          <Lockup name={store.name} tagline={store.tagline} size="lg" />
        </div>
        <AwningHem />
        <div className="mx-auto mt-8 max-w-[60ch] text-center">
          <p className="caps mb-3 text-[0.75rem] text-gold-text">Plymouth, Massachusetts</p>
          <p className="mb-6 text-lg">
            Gift baskets, Phillips chocolates, fudge and treats, wrapped by hand in our Plymouth shop. Choose from our
            favorites or let us build a basket around your budget.
          </p>
          <p className="flex flex-wrap justify-center gap-3">
            <Link href="/shop" className={`${button} bg-gold-text text-paper`}>
              Shop sweets
            </Link>
            <Link href="/build-a-basket" className={`${button} border border-gold-text text-gold-text`}>
              Custom baskets
            </Link>
          </p>
        </div>
      </section>

      <section aria-label="From the shop" className="mb-12">
        <PhotoStrip images={(home.stripImages ?? []).map((row) => row.image)} />
      </section>

      {featured.length > 0 && (
        <section aria-labelledby="favorites" className="mb-12">
          <h2 id="favorites" className="mb-6 text-center text-2xl">
            Shop favorites
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] gap-5">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ul>
          <p className="mt-6 flex flex-wrap justify-center gap-6">
            <Link href="/shop" className="caps text-[0.75rem] text-gold-text">
              See the whole shop
            </Link>
            <Link href="/baby-gifts" className="caps text-[0.75rem] text-gold-text">
              Baby gifts
            </Link>
          </p>
        </section>
      )}

      <section aria-labelledby="get-it" className="mb-4 grid gap-4 md:grid-cols-3">
        <h2 id="get-it" className="sr-only">
          Getting your order
        </h2>
        <div className="border-t-4 border-coastal bg-coastal-pale p-5">
          <h3 className="mb-1 text-xl">Pickup</h3>
          <p>
            Free from our shop at {store.street}, {store.locality}.
          </p>
        </div>
        <div className="border-t-4 border-coastal bg-coastal-pale p-5">
          <h3 className="mb-1 text-xl">Local delivery</h3>
          <p>
            Through DoorDash
            {store.doordashUrl ? (
              <>
                {" "}
                — <a href={store.doordashUrl}>order on our DoorDash page</a>.
              </>
            ) : (
              "."
            )}{" "}
            Shipping is coming with online checkout.
          </p>
        </div>
        <div className="border-t-4 border-coastal bg-coastal-pale p-5">
          <h3 className="mb-1 text-xl">Order by phone</h3>
          <p>
            Online checkout is coming soon. Call <a href={telHref(store.phone)}>{store.phone}</a> today.
          </p>
        </div>
      </section>
    </div>
  );
}

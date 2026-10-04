import Link from "next/link";

import { AwningHem } from "@/components/brand/Awning";
import { Lockup } from "@/components/brand/Lockup";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductImage } from "@/components/catalog/ProductImage";
import { FavoritesSlider } from "@/components/home/FavoritesSlider";
import { PhotoStrip } from "@/components/home/PhotoStrip";
import { listProducts } from "@/src/lib/catalog/queries";
import { favoritesLayout, favoritesLimit } from "@/src/lib/home";
import { telHref } from "@/src/lib/phone";
import { getHomePage, getStoreSettings, isImagePublishable } from "@/src/lib/store";

// Grid layouts Lody can pick in /admin → Home page (D33). Phones show two columns, or one when
// text is enlarged so cards never overflow.
const GRID = { "grid-2x2": "mx-auto max-w-[40rem]", "grid-3x2": "lg:grid-cols-3" } as const;

const button = "caps inline-flex min-h-11 items-center px-7 text-[0.75rem] no-underline";

export default async function HomePage() {
  const [store, home] = await Promise.all([getStoreSettings(), getHomePage()]);
  const layout = favoritesLayout(home.favoritesLayout);
  const featured = await listProducts({ featured: true, limit: favoritesLimit(layout) });
  const hero = typeof home.heroImage === "object" ? home.heroImage : null;

  return (
    <div className="mx-auto w-[min(100%-2rem,72rem)]">
      {/* The board's awning, drawn; an approved shop photo uploaded in /admin replaces it. */}
      <section aria-labelledby="welcome" className="mb-10">
        <h1 id="welcome" className="sr-only">
          {store.name} — {store.tagline}
        </h1>
        {hero && isImagePublishable(hero) ? (
          <div className="border border-gold bg-paper p-1.5">
            <ProductImage media={hero} size="large" priority className="aspect-[16/7] w-full object-cover!" />
          </div>
        ) : (
          <>
            <div className="border-x border-t border-gold bg-paper px-6 pt-10 pb-8">
              <Lockup name={store.name} tagline={store.tagline} size="lg" />
            </div>
            <AwningHem />
          </>
        )}
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
          {layout === "slider" ? (
            <FavoritesSlider count={featured.length}>
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </FavoritesSlider>
          ) : (
            <ul className={`grid grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-3 sm:grid-cols-2 sm:gap-5 ${GRID[layout]}`}>
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </ul>
          )}
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

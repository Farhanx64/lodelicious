import config from "@payload-config";
import type { Metadata } from "next";
import { getPayload } from "payload";

import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductImage } from "@/components/catalog/ProductImage";
import type { Media } from "@/payload-types";
import { listProducts } from "@/src/lib/catalog/queries";
import { telHref } from "@/src/lib/phone";
import { getStoreSettings } from "@/src/lib/store";

export const metadata: Metadata = { title: "Baby Gifts" };

export default async function BabyGiftsPage() {
  const payload = await getPayload({ config });
  const [products, store, rules] = await Promise.all([
    listProducts({ category: "baby-gifts" }),
    getStoreSettings(),
    payload.findGlobal({ slug: "gift-builder-settings", depth: 1, overrideAccess: false }),
  ]);
  const babyWhite = rules.specialPresentations?.find((p) => p.code === "baby_white" && p.status !== "disabled");

  return (
    <div className="mx-auto w-[min(100%-2rem,72rem)]">
      <h1 className="mb-2 text-[clamp(2.25rem,5vw,3.25rem)]">Baby Gifts</h1>
      <p className="mb-10 max-w-[68ch] text-ink-soft">
        Keepsake ceramics and baby gift baskets, filled with sweets and finished by hand in our Plymouth shop.
      </p>

      {babyWhite && (
        <section aria-labelledby="baby-white" className="mb-12 grid grid-cols-[minmax(0,1fr)] gap-6 border border-line bg-paper p-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <ProductImage media={babyWhite.image as Media | number | null} className="aspect-square w-full" />
          <div>
            <h2 id="baby-white" className="mb-2 text-3xl">
              {babyWhite.name}
            </h2>
            {babyWhite.container && <p className="mb-3 text-ink-soft">{babyWhite.container}</p>}
            <p className="mb-2">Includes:</p>
            <ul className="mb-3 list-disc pl-6">
              {(babyWhite.includedComponents ?? []).map((c) => (
                <li key={c.id ?? c.value}>{c.value}</li>
              ))}
              <li>
                Your choice of {babyWhite.minSelections}–{babyWhite.maxSelections} candies or chocolates
              </li>
            </ul>
            {babyWhite.status === "inquiry" && (
              <p className="border-l-4 border-gold bg-cream p-4">
                Made to order — call <a href={telHref(store.phone)}>{store.phone}</a> or email{" "}
                <a href={`mailto:${store.email}`}>{store.email}</a> to arrange yours.
              </p>
            )}
          </div>
        </section>
      )}

      <h2 className="mb-4 text-3xl">Baby ceramics</h2>
      <p className="mb-6 max-w-[68ch]">
        Pink or blue, sold empty or filled with sweets. Ask us about filling one for a baby shower or new arrival.
      </p>
      {products.length === 0 ? (
        <p>Our baby ceramics will be listed here soon.</p>
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

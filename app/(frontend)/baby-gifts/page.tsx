import config from "@payload-config";
import type { Metadata } from "next";
import Link from "next/link";
import { getPayload } from "payload";

import { ProductCard, productGrid } from "@/components/catalog/ProductCard";
import { ProductImage } from "@/components/catalog/ProductImage";
import { secondaryButton } from "@/components/checkout/styles";
import type { Media } from "@/payload-types";
import { listProducts } from "@/src/lib/catalog/queries";
import { contactHref } from "@/src/lib/inquiries/shared";
import { telHref } from "@/src/lib/phone";
import { getStoreSettings } from "@/src/lib/store";
import { Accent } from "@/components/ui/Accent";

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
    <div className="shell page">
      <h1 className="mb-5">
        <Accent text="Baby Gifts" />
      </h1>
      <p className="mb-10 max-w-[68ch] text-muted">
        Keepsake ceramics and baby gift baskets, filled with sweets and finished by hand in our Plymouth shop.
      </p>

      {babyWhite && (
        <section aria-labelledby="baby-white" className="panel mb-16 grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <ProductImage media={babyWhite.image as Media | number | null} className="aspect-square w-full" />
          <div>
            <h2 id="baby-white" className="mb-2">
              {babyWhite.name}
            </h2>
            {babyWhite.container && <p className="mb-3 text-muted">{babyWhite.container}</p>}
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
              <div className="rounded-2xl bg-cream p-4">
                <p className="mb-3">
                  Made to order — call <a href={telHref(store.phone)}>{store.phone}</a> or email{" "}
                  <a href={`mailto:${store.email}`}>{store.email}</a> to arrange yours.
                </p>
                <Link href={contactHref({ topic: "baby_white" })} className={secondaryButton}>
                  Ask about the Baby White basket
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      <h2 className="mb-4">Baby ceramics</h2>
      <p className="mb-6 max-w-[68ch]">
        Pink or blue, sold empty or filled with sweets. Ask us about filling one for a baby shower or new arrival.
      </p>
      <p className="mb-6">
        <Link href={contactHref({ topic: "filled_ceramic" })} className={secondaryButton}>
          Ask about a filled ceramic
        </Link>
      </p>
      {products.length === 0 ? (
        <p>Our baby ceramics will be listed here soon.</p>
      ) : (
        <ul className={productGrid}>
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </ul>
      )}
    </div>
  );
}

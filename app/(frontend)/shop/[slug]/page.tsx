import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AvailabilityNote } from "@/components/catalog/ProductCard";
import { ProductImage } from "@/components/catalog/ProductImage";
import { AddToBag, type BagOption } from "@/components/checkout/AddToBag";
import { primaryButton } from "@/components/checkout/styles";
import type { Category } from "@/payload-types";
import { getProduct } from "@/src/lib/catalog/queries";
import { previewStockEnabled } from "@/src/lib/catalog/preview";
import { PRICE_ON_REQUEST, priceLabel, sellableUnits, unitPriceLabel } from "@/src/lib/catalog/product";
import { priceCart } from "@/src/lib/checkout/cart";
import { contactHref, topicForProduct } from "@/src/lib/inquiries/shared";
import { telHref } from "@/src/lib/phone";
import { getStoreSettings } from "@/src/lib/store";
import { publishableProductImages } from "@/src/lib/media";
import { Accent } from "@/components/ui/Accent";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  return product ? { title: product.title, description: product.shortDescription ?? undefined } : {};
}

const NUT_FREE: Record<string, string> = {
  yes: "Nut-free",
  no: "Contains nuts or peanuts",
  not_guaranteed: "Nut-free not guaranteed",
};

export default async function ProductPage({ params }: Props) {
  const [product, store] = await Promise.all([getProduct((await params).slug), getStoreSettings()]);
  if (!product) notFound();

  const category = typeof product.category === "object" ? (product.category as Category) : null;
  const images = publishableProductImages(product.images);
  const units = sellableUnits(product);
  // Options that can go in the bag now (the bag re-checks everything at checkout).
  const bagOptions: BagOption[] = priceCart(
    units.map((u) => ({ unitId: u.id, quantity: 1 })),
    [product],
    { previewStock: previewStockEnabled(), taxClasses: [], defaultTaxClassId: null },
  ).payable.map((l) => ({ unitId: l.unitId, label: l.optionLabel, priceCents: l.unitPriceCents }));
  const price = priceLabel(product);
  const dietary = [
    product.nutFree !== "unknown" ? NUT_FREE[product.nutFree] : null,
    product.vegan === "yes" ? "Vegan" : product.vegan === "no" ? "Not vegan" : null,
  ].filter(Boolean);

  return (
    <div className="shell page">
      <nav aria-label="Breadcrumb" className="label-caps mb-8 text-muted">
        <ol className="flex flex-wrap items-center gap-2 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center">
          <li>
            <Link href="/shop">Shop</Link>
          </li>
          {category && (
            <li>
              <span aria-hidden="true">/ </span>
              <Link href={`/shop?category=${category.slug}`}>{category.name}</Link>
            </li>
          )}
        </ol>
      </nav>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-16 gap-y-10 md:grid-cols-2 lg:gap-x-24">
        <div className="flex flex-col gap-4 md:sticky md:top-28 md:self-start">
          <div className="overflow-hidden rounded-[2rem] bg-clay">
            <ProductImage media={images[0]} size="large" priority fit="cover" className="aspect-[4/5] w-full" />
          </div>
          {images.length > 1 && (
            <ul className="grid grid-cols-4 gap-3">
              {images.slice(1).map((m, i) => (
                <li key={i} className="overflow-hidden rounded-xl bg-clay">
                  <ProductImage media={m} size="thumb" fit="cover" className="aspect-square w-full" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          {product.brand && <p className="label-caps mb-4 text-rose-deep">{product.brand}</p>}
          <h1 className="mb-5 text-[clamp(2.5rem,5vw,4.5rem)]! break-words">
        <Accent text={product.title} />
      </h1>
          {product.sizeLabel && <p className="label-caps mb-4 text-muted">{product.sizeLabel}</p>}
          <div className="mb-8 flex flex-wrap items-baseline gap-4 border-b border-line pb-8">
            {product.priceApproved && price !== PRICE_ON_REQUEST ? <p className="font-display text-[2rem] leading-none">{price}</p> : <p className="label-caps text-muted">{price}</p>}
            <AvailabilityNote product={product} />
          </div>

          {product.shortDescription && <p className="mb-4 text-[1.1875rem]">{product.shortDescription}</p>}
          {product.description && product.description !== product.shortDescription && (
            <p className="mb-8 whitespace-pre-line text-muted">{product.description}</p>
          )}

          {units.length > 1 && (
            <section aria-labelledby="options" className="mb-8">
              <h2 id="options" className="label-caps mb-3 text-muted">
                Options
              </h2>
              <ul className="divide-y divide-line border-y border-line">
                {units.map((u) => (
                  <li key={u.id} className="flex flex-wrap justify-between gap-2 py-3">
                    <span>{u.variantKey ? u.name.replace(`${product.title} — `, "") : u.name}</span>
                    <span className="text-muted">
                      {unitPriceLabel(product, u)}
                      {u.availability.label ? ` · ${u.availability.label}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {bagOptions.length > 0 ? (
            <AddToBag options={bagOptions} />
          ) : (
            <div className="note mb-8">
              <p>
                {product.channel === "inquiry_only" ? "Available by inquiry." : "Not available to order online right now."} To order, call{" "}
                <a href={telHref(store.phone)}>{store.phone}</a> or visit us at {store.street}, {store.locality}.
              </p>
              {product.channel === "inquiry_only" && product.slug && (
                // Inquiry-only products (D37): ask the shop instead of buying online.
                <p className="mt-3">
                  <Link href={contactHref({ topic: topicForProduct(category?.slug), item: product.slug })} className={primaryButton}>
                    Ask about this
                  </Link>
                </p>
              )}
            </div>
          )}

          <section aria-labelledby="allergens" className="mt-10 border-t border-line pt-8">
            <h2 id="allergens" className="mb-4">
              Allergens &amp; dietary
            </h2>
            {dietary.length > 0 && <p className="label-caps mb-3">{dietary.join(" · ")}</p>}
            {product.allergenNotes ? (
              <p className="mb-3">{product.allergenNotes}</p>
            ) : (
              <p className="mb-3">Allergen information for this product hasn&rsquo;t been added yet — please ask us before ordering.</p>
            )}
            <p className="text-sm text-muted">{store.allergyNotice}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

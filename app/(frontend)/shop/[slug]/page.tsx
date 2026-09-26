import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AvailabilityNote, formatPrice } from "@/components/catalog/ProductCard";
import { ProductImage } from "@/components/catalog/ProductImage";
import type { Category, Media } from "@/payload-types";
import { getProduct } from "@/src/lib/catalog/queries";
import { sellableUnits } from "@/src/lib/catalog/product";
import { formatCents } from "@/src/lib/money";
import { telHref } from "@/src/lib/phone";
import { getStoreSettings } from "@/src/lib/store";

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
  const images = (product.images ?? []).map((i) => i.image as Media | number);
  const units = sellableUnits(product);
  const price = formatPrice(product);
  const dietary = [
    product.nutFree !== "unknown" ? NUT_FREE[product.nutFree] : null,
    product.vegan === "yes" ? "Vegan" : product.vegan === "no" ? "Not vegan" : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto w-[min(100%-2rem,72rem)]">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <ol className="flex flex-wrap gap-2">
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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <ProductImage media={images[0]} size="large" priority className="w-full border border-line" />
          {images.length > 1 && (
            <ul className="grid grid-cols-4 gap-2">
              {images.slice(1).map((m, i) => (
                <li key={i}>
                  <ProductImage media={m} size="thumb" className="aspect-square w-full border border-line" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          {product.brand && <p className="text-sm tracking-[0.12em] text-gold-text uppercase">{product.brand}</p>}
          <h1 className="mb-2 text-[clamp(2rem,4vw,3rem)]">{product.title}</h1>
          {product.sizeLabel && <p className="mb-3 text-ink-soft">{product.sizeLabel}</p>}
          <div className="mb-4 flex flex-wrap items-baseline gap-4">
            {price ? <p className="text-2xl font-semibold">{price}</p> : <p>Price on request</p>}
            <AvailabilityNote product={product} />
          </div>

          {product.shortDescription && <p className="mb-4 text-lg">{product.shortDescription}</p>}
          {product.description && product.description !== product.shortDescription && (
            <p className="mb-6 whitespace-pre-line">{product.description}</p>
          )}

          {units.length > 1 && (
            <section aria-labelledby="options" className="mb-6">
              <h2 id="options" className="mb-2 text-xl">
                Options
              </h2>
              <ul className="divide-y divide-line border border-line bg-paper">
                {units.map((u) => (
                  <li key={u.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                    <span>{u.variantKey ? u.name.replace(`${product.title} — `, "") : u.name}</span>
                    <span className="text-ink-soft">
                      {u.priceCents !== null ? formatCents(u.priceCents) : ""}
                      {u.availability.label ? ` · ${u.availability.label}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mb-8 border-l-4 border-gold bg-paper p-4">
            Online ordering is being prepared. To order now, call{" "}
            <a href={telHref(store.phone)}>{store.phone}</a> or visit us at {store.street}, {store.locality}.
          </p>

          <section aria-labelledby="allergens" className="border-t border-line pt-6">
            <h2 id="allergens" className="mb-2 text-xl">
              Allergens &amp; dietary
            </h2>
            {dietary.length > 0 && <p className="mb-2 font-semibold">{dietary.join(" · ")}</p>}
            {product.allergenNotes ? (
              <p className="mb-3">{product.allergenNotes}</p>
            ) : (
              <p className="mb-3">Allergen information for this product hasn&rsquo;t been added yet — please ask us before ordering.</p>
            )}
            <p className="text-sm text-ink-soft">{store.allergyNotice}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";

import type { Product } from "@/payload-types";
import { PRICE_ON_REQUEST, priceLabel, productAvailability } from "@/src/lib/catalog/product";
import { publishableProductImages } from "@/src/lib/media";

import { ProductImage } from "./ProductImage";

export function AvailabilityNote({ product }: { product: Product }) {
  const availability = productAvailability(product);
  if (!availability.label) return null;
  const tone = availability.status === "low_stock" ? "text-gold-text" : "text-ink-soft";
  return <p className={`text-sm font-semibold ${tone}`}>{availability.label}</p>;
}

/**
 * A card never shows a price staff have not approved: it says "Price to be confirmed" instead
 * (A06, D41), on every listing. The photo is decorative because the title link beside it already
 * names the product (A18).
 */
export function ProductCard({ product }: { product: Product }) {
  const image = publishableProductImages(product.images)[0];
  const price = priceLabel(product);
  const isPrice = product.priceApproved && price !== PRICE_ON_REQUEST;
  return (
    // Gold double frame around every product (Lody's board): outer antique-gold line, ivory gap,
    // inner hairline. Decorative only; the title link carries the meaning.
    <li className="group relative flex flex-col border border-gold bg-paper p-1.5">
      <div className="flex flex-1 flex-col border border-gold/50">
        <ProductImage media={image} decorative className="aspect-square w-full" />
        <div className="flex flex-1 flex-col gap-1 p-4">
          {product.brand && <p className="text-xs tracking-[0.12em] text-gold-text uppercase">{product.brand}</p>}
          <h3 className="text-xl leading-snug">
            <Link href={`/shop/${product.slug}`} className="no-underline after:absolute after:inset-0 group-focus-within:underline hover:underline">
              {product.title}
            </Link>
          </h3>
          {product.sizeLabel && <p className="text-sm text-ink-soft">{product.sizeLabel}</p>}
          <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 pt-2">
            <p className={isPrice ? "text-lg font-semibold text-gold-text" : "text-sm text-ink-soft"}>{price}</p>
            <AvailabilityNote product={product} />
          </div>
        </div>
      </div>
    </li>
  );
}

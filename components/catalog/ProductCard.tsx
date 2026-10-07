import Link from "next/link";

import type { Media, Product } from "@/payload-types";
import { priceRange, productAvailability } from "@/src/lib/catalog/product";
import { formatCents } from "@/src/lib/money";

import { ProductImage } from "./ProductImage";

export function formatPrice(product: Product): string | null {
  const range = priceRange(product);
  if (!range) return null;
  return range.min === range.max ? formatCents(range.min) : `From ${formatCents(range.min)}`;
}

export function AvailabilityNote({ product }: { product: Product }) {
  const availability = productAvailability(product);
  if (!availability.label) return null;
  const tone = availability.status === "low_stock" ? "text-gold-text" : "text-ink-soft";
  return <p className={`text-sm font-semibold ${tone}`}>{availability.label}</p>;
}

/**
 * `hideUnapprovedPrice`: show "Price on request" instead of a price staff have not approved yet.
 * Off by default, so other listings are unchanged; /gift-baskets turns it on (D38).
 */
export function ProductCard({ product, hideUnapprovedPrice = false }: { product: Product; hideUnapprovedPrice?: boolean }) {
  const image = product.images?.[0]?.image as Media | number | undefined;
  const price = hideUnapprovedPrice && !product.priceApproved ? null : formatPrice(product);
  return (
    // Gold double frame around every product (Lody's board): outer antique-gold line, ivory gap,
    // inner hairline. Decorative only; the title link carries the meaning.
    <li className="group relative flex flex-col border border-gold bg-paper p-1.5">
      <div className="flex flex-1 flex-col border border-gold/50">
        <ProductImage media={image} className="aspect-square w-full" />
        <div className="flex flex-1 flex-col gap-1 p-4">
          {product.brand && <p className="text-xs tracking-[0.12em] text-gold-text uppercase">{product.brand}</p>}
          <h3 className="text-xl leading-snug">
            <Link href={`/shop/${product.slug}`} className="no-underline after:absolute after:inset-0 group-focus-within:underline hover:underline">
              {product.title}
            </Link>
          </h3>
          {product.sizeLabel && <p className="text-sm text-ink-soft">{product.sizeLabel}</p>}
          <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 pt-2">
            {price ? <p className="text-lg font-semibold text-gold-text">{price}</p> : <p className="text-sm text-ink-soft">Price on request</p>}
            <AvailabilityNote product={product} />
          </div>
        </div>
      </div>
    </li>
  );
}

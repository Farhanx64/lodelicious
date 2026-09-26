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

export function ProductCard({ product }: { product: Product }) {
  const image = product.images?.[0]?.image as Media | number | undefined;
  const price = formatPrice(product);
  return (
    <li className="group relative flex flex-col border border-line bg-paper">
      <ProductImage media={image} className="aspect-square w-full" />
      <div className="flex flex-1 flex-col gap-1 p-4">
        {product.brand && <p className="text-xs tracking-[0.12em] text-gold-text uppercase">{product.brand}</p>}
        <h3 className="text-xl leading-snug">
          <Link href={`/shop/${product.slug}`} className="no-underline after:absolute after:inset-0 group-focus-within:underline hover:underline">
            {product.title}
          </Link>
        </h3>
        {product.sizeLabel && <p className="text-sm text-ink-soft">{product.sizeLabel}</p>}
        <div className="mt-auto flex items-baseline justify-between gap-2 pt-2">
          {price ? <p className="text-lg font-semibold">{price}</p> : <p className="text-sm text-ink-soft">Price on request</p>}
          <AvailabilityNote product={product} />
        </div>
      </div>
    </li>
  );
}

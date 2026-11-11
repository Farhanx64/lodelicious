import Link from "next/link";

import type { Product } from "@/payload-types";
import { QuickAdd } from "@/components/checkout/QuickAdd";
import { previewStockEnabled } from "@/src/lib/catalog/preview";
import { PRICE_ON_REQUEST, priceLabel, productAvailability, sellableUnits } from "@/src/lib/catalog/product";
import { priceCart } from "@/src/lib/checkout/cart";
import { publishableProductImages } from "@/src/lib/media";

import { RevealItem } from "@/components/motion/Reveal";

import { ProductImage } from "./ProductImage";

/** Options that can go in the bag right now, by the same rules the bag uses (including staging's assumed stock). */
function payableUnits(product: Product) {
  return priceCart(
    sellableUnits(product).map((u) => ({ unitId: u.id, quantity: 1 })),
    [product],
    { previewStock: previewStockEnabled(), taxClasses: [], defaultTaxClassId: null },
  ).payable;
}

export function AvailabilityNote({ product }: { product: Product }) {
  const availability = productAvailability(product);
  if (!availability.label) return null;
  // Staging assumes uncounted stock is available, so don't call it unavailable when it can be bought.
  if (availability.status === "unavailable" && payableUnits(product).length > 0) return null;
  const tone = availability.status === "low_stock" ? "w-fit rounded-full bg-clay px-3 py-0.5 text-cocoa" : "text-muted";
  return <p className={`text-sm font-normal ${tone}`}>{availability.label}</p>;
}

/** Product listing grid: two tiles across on phones (one when text is enlarged), three on tablets, four on desktop. */
export const productGrid =
  "grid grid-cols-[repeat(auto-fill,minmax(min(10rem,100%),1fr))] gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 md:gap-y-14 xl:grid-cols-4";

/**
 * A product tile (D49): a tall 4:5 photo on the clay card colour, then the name in the serif, one
 * line about it, and its size and price as small labels. Tiles fade up as they scroll into view,
 * a step apart along the row, and the photo eases in a little on hover.
 *
 * A tile never shows a price staff have not approved: it says "Price to be confirmed" instead
 * (A06, D41), on every listing. The photo is decorative because the title link beside it already
 * names the product (A18).
 */
export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const image = publishableProductImages(product.images)[0];
  const price = priceLabel(product);
  const isPrice = product.priceApproved && price !== PRICE_ON_REQUEST;
  const payable = payableUnits(product);
  return (
    <RevealItem index={index % 4} className="group relative flex flex-col">
      <div className="aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-clay">
        <ProductImage
          media={image}
          decorative
          fit="cover"
          blend
          className="size-full transition-transform duration-[800ms] ease-soft group-hover:scale-[1.04] motion-reduce:group-hover:scale-100"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 pt-4">
        {product.brand && <p className="label-caps text-muted">{product.brand}</p>}
        <h3 className="leading-[1.1] break-words sm:text-2xl">
          <Link href={`/shop/${product.slug}`} className="no-underline after:absolute after:inset-0 group-focus-within:underline hover:underline">
            {product.title}
          </Link>
        </h3>
        {product.shortDescription && <p className="line-clamp-1 text-[0.9375rem] leading-normal text-muted">{product.shortDescription}</p>}
        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-3">
          {product.sizeLabel && <p className="label-caps text-muted">{product.sizeLabel}</p>}
          <p className={`label-caps ${isPrice ? "text-cocoa" : "text-muted"}`}>{price}</p>
        </div>
        <AvailabilityNote product={product} />
        {payable.length > 0 && (
          <QuickAdd options={payable.map((l) => ({ unitId: l.unitId, label: l.optionLabel, priceCents: l.unitPriceCents }))} title={product.title} />
        )}
      </div>
    </RevealItem>
  );
}

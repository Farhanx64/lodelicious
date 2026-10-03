import { Bow } from "@/components/brand/Bow";
import { ProductImage } from "@/components/catalog/ProductImage";
import type { Media } from "@/payload-types";

// Placeholder panels cycle through the board's palette until Lody uploads her own photos.
const PANELS = ["bg-coastal-pale", "bg-ivory", "bg-blush", "bg-linen", "bg-ivory"];

/** The five-photo strip along the bottom of the board, filled from Home page settings. */
export function PhotoStrip({ images }: { images: (Media | number | null | undefined)[] }) {
  return (
    <ul aria-label="Photos from the shop" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {PANELS.map((panel, i) => {
        const media = images[i];
        return (
          <li key={i} className={`relative aspect-[6/5] overflow-hidden ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
            {media ? (
              <ProductImage media={media} size="card" className="size-full object-cover!" />
            ) : (
              <div data-placeholder className={`flex size-full items-center justify-center ${panel}`}>
                <Bow className="w-12 text-gold" />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

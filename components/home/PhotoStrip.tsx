import { Bow } from "@/components/brand/Bow";
import { ProductImage } from "@/components/catalog/ProductImage";
import type { Media } from "@/payload-types";
import { isImagePublishable } from "@/src/lib/media";

// Placeholder panels cycle through the board's palette until Lody uploads her own photos.
const PANELS = ["bg-coastal-pale", "bg-ivory", "bg-blush", "bg-linen", "bg-ivory"];

/**
 * The board's five-photo strip, filled from Home page settings. Missing photos, and unapproved placeholders on the live site, show a
 * palette panel with the gold bow instead (D32).
 */
export function PhotoStrip({ images, priority = false }: { images: (Media | number | null | undefined)[]; priority?: boolean }) {
  return (
    <ul aria-label="Photos from the shop" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {PANELS.map((panel, i) => {
        const media = images[i];
        const doc = typeof media === "object" ? media : null;
        return (
          <li key={i} className={`relative aspect-[6/5] overflow-hidden ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
            {doc && isImagePublishable(doc) ? (
              // The first is the likely LCP when there is no hero photo, so it loads first; five across from 640 px.
              <ProductImage media={doc} size="card" priority={priority && i === 0} sizes="(min-width: 640px) 20vw, 50vw" className="size-full object-cover!" />
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

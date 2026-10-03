import { Bow } from "@/components/brand/Bow";
import { ProductImage } from "@/components/catalog/ProductImage";
import type { Media } from "@/payload-types";
import { isImagePublishable } from "@/src/lib/media";

// Placeholder panels cycle through the board's palette until Lody uploads her own photos.
const PANELS = ["bg-coastal-pale", "bg-ivory", "bg-blush", "bg-linen", "bg-ivory"];

const LAYOUT = {
  // Beside the logo panel on desktop the tiles stretch to the panel's height, as on the board.
  4: { grid: "grid-cols-2 sm:grid-cols-4 md:min-h-56", aspect: "aspect-[8/7] md:aspect-auto md:h-full" },
  5: { grid: "grid-cols-2 sm:grid-cols-5", aspect: "aspect-[6/5]" },
} as const;

/**
 * A row of photos from the board (the four tiles beside the logo, or the five-photo strip), filled
 * from Home page settings. Missing photos, and unapproved placeholders on the live site, show a
 * palette panel with the gold bow instead (D32).
 */
export function PhotoStrip({ images, count = 5, label = "Photos from the shop" }: { images: (Media | number | null | undefined)[]; count?: 4 | 5; label?: string }) {
  const { grid, aspect } = LAYOUT[count];
  return (
    <ul aria-label={label} className={`grid gap-2 ${grid}`}>
      {Array.from({ length: count }, (_, i) => {
        const media = images[i];
        const doc = typeof media === "object" ? media : null;
        const odd = count % 2 === 1 && i === count - 1;
        return (
          <li key={i} className={`relative overflow-hidden ${aspect} ${odd ? "col-span-2 sm:col-span-1" : ""}`}>
            {doc && isImagePublishable(doc) ? (
              <ProductImage media={doc} size="card" className="size-full object-cover!" />
            ) : (
              <div data-placeholder className={`flex size-full items-center justify-center ${PANELS[i % PANELS.length]}`}>
                <Bow className="w-12 text-gold" />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

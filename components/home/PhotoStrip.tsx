import { Asterisk } from "lucide-react";

import { ProductImage } from "@/components/catalog/ProductImage";
import type { Media } from "@/payload-types";
import { isImagePublishable } from "@/src/lib/media";

// Five frames, stepped up and down like prints laid on a table.
const FRAMES = ["md:mt-0", "md:mt-16", "md:mt-6", "md:mt-20", "md:mt-2"];

/**
 * Five photos from Home page settings, shown as editorial cards: a sideways snap row on phones, a
 * stepped row of five on wider screens. Missing photos, and unapproved placeholders on the live
 * site, show a clay panel with a small asterisk instead (D32).
 */
export function PhotoStrip({ images }: { images: (Media | number | null | undefined)[] }) {
  return (
    <ul
      aria-label="Photos from the shop"
      className="grid snap-x snap-mandatory auto-cols-[62%] grid-flow-col gap-4 overflow-x-auto pb-4 [scrollbar-color:var(--color-rose)_transparent] [scrollbar-width:thin] sm:auto-cols-[38%] md:auto-cols-auto md:grid-flow-row md:grid-cols-5 md:items-start md:gap-6 md:overflow-visible md:pb-0"
    >
      {FRAMES.map((frame, i) => {
        const media = images[i];
        const doc = typeof media === "object" ? media : null;
        return (
          <li key={i} className={`relative aspect-[3/4] snap-start overflow-hidden rounded-[1.25rem] bg-clay ${frame}`}>
            {doc && isImagePublishable(doc) ? (
              <ProductImage media={doc} size="card" fit="cover" className="size-full" />
            ) : (
              <div data-placeholder className="flex size-full items-center justify-center text-rose">
                <Asterisk size={28} strokeWidth={1.25} aria-hidden="true" />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

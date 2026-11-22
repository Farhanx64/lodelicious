import type { Media } from "@/payload-types";
import { isImagePublishable } from "@/src/lib/media";

type Size = "thumb" | "card" | "large";

/**
 * Payload's resized uploads (WebP, D69), served as plain <img> with srcset. No Next image
 * optimizer: it needs sharp, which Cloudflare Workers can't run (D51).
 */
export function ProductImage({
  media,
  size = "card",
  className = "",
  priority = false,
  decorative = false,
  sizes: sizesAttr,
}: {
  media: Media | number | null | undefined;
  size?: Size;
  className?: string;
  priority?: boolean;
  /**
   * For a photo beside a link that already names the product (a product card): empty alt, so a
   * screen reader does not read the title twice (A18). The "coming soon" tile is hidden too.
   */
  decorative?: boolean;
  /** The `sizes` attribute, when the default for `size` doesn't match the layout. */
  sizes?: string;
}) {
  const doc = typeof media === "object" ? media : null;
  if (!doc || !isImagePublishable(doc) || !doc.url) {
    return (
      <div aria-hidden={decorative || undefined} className={`flex aspect-square items-center justify-center bg-linen text-sm text-ink-soft ${className}`}>
        Photo coming soon
      </div>
    );
  }
  const sizes = doc.sizes ?? {};
  const candidates = [sizes.thumb, sizes.card, sizes.large]
    .filter((s): s is NonNullable<typeof s> => Boolean(s?.url && s.width))
    .map((s) => `${s.url} ${s.width}w`);
  const src = sizes[size]?.url ?? doc.url;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see component comment
    <img
      src={src}
      srcSet={candidates.length ? candidates.join(", ") : undefined}
      sizes={sizesAttr ?? (size === "large" ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw")}
      // Decorative copies (next to the product name in a card) stay hidden from screen readers, but keep
      // their alt text for image search (D68).
      alt={doc.alt || ""}
      aria-hidden={decorative || undefined}
      width={doc.width ?? undefined}
      height={doc.height ?? undefined}
      // The page's main photo is the Largest Contentful Paint: load it first (D69). Others wait until near the screen.
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={`bg-white object-contain ${className}`}
    />
  );
}

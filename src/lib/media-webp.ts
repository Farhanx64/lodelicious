/**
 * Planning for `scripts/media-webp.ts` (D69): which resized WebP copies a photo still needs.
 * Framework-free so it is unit tested. Mirrors Payload's own rule: a size wider than the original
 * is not made (the storefront then uses the next size down, or the original).
 */

export type SizeSpec = { readonly name: string; readonly width: number };
export type StoredSize = { filename?: string | null; mimeType?: string | null; width?: number | null } | null | undefined;
export type MediaLike = {
  id: number | string;
  filename?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  sizes?: Record<string, StoredSize> | null;
};

const RESIZABLE = /^image\/(jpeg|png|webp|avif)$/;

/** "Gift Tray.png" + 720 x 788 → "Gift Tray-720x788.webp", as Payload names sizes. */
export function sizeFilename(original: string, width: number, height: number): string {
  const dot = original.lastIndexOf(".");
  const base = dot > 0 ? original.slice(0, dot) : original;
  return `${base}-${width}x${height}.webp`;
}

/** The sizes to (re)make as WebP, with their target height (rounded like sharp). */
export function plannedSizes(doc: MediaLike, specs: readonly SizeSpec[]): { name: string; width: number; height: number }[] {
  if (!doc.filename || !doc.mimeType || !RESIZABLE.test(doc.mimeType) || !doc.width || !doc.height) return [];
  const { width, height } = doc;
  return specs
    .filter((s) => s.width <= width)
    .filter((s) => doc.sizes?.[s.name]?.mimeType !== "image/webp" || !doc.sizes?.[s.name]?.filename)
    .map((s) => ({ name: s.name, width: s.width, height: Math.round((height * s.width) / width) }));
}

/** The file URL Payload stores for a size. */
export const fileUrl = (filename: string) => `/api/media/file/${encodeURIComponent(filename)}`;

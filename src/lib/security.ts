/**
 * Security settings shared by next.config.ts and payload.config.ts (D41, audit A08).
 * Plain TypeScript with no imports so it loads in both, and in unit tests.
 */

export type HeaderRule = { source: string; headers: { key: string; value: string }[] };

/** A year, in seconds. Deliberately no includeSubDomains or preload: changing domain settings needs Lody's approval. */
export const HSTS_VALUE = "max-age=31536000";

/**
 * Response headers for the whole site. Next evaluates `headers()` when the app is built, so
 * `hsts` follows the environment of the `next build`: on for a production build, off for local,
 * staging and test builds, where an HSTS pin on a throwaway host would only get in the way.
 *
 * Later rules win for the same header on the same path, so the stricter receipt-page rule comes last.
 */
export function securityHeaders({ hsts }: { hsts: boolean }): HeaderRule[] {
  return [
    {
      source: "/:path*",
      headers: [
        // The site and /admin may not be framed by another site (clickjacking). Same-origin framing, which
        // Payload's own previews use, still works.
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ...(hsts ? [{ key: "Strict-Transport-Security", value: HSTS_VALUE }] : []),
      ],
    },
    {
      // The receipt link carries the guest token in the query string: never send it on as a referrer.
      source: "/order/:path*",
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    },
    {
      source: "/reservation/:path*",
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    },
  ];
}

/**
 * The origins Payload accepts cookie-authenticated API requests from, taken from
 * NEXT_PUBLIC_SITE_URL (a single URL, or several separated by commas, e.g. the apex and www).
 * Empty when it is unset, which leaves Payload's CSRF allowlist off so local development, tunnels
 * and tests keep working. Origins are normalised (no path, no trailing slash) because the
 * browser's Origin header never has one.
 */
export function csrfOrigins(env: Record<string, string | undefined>): string[] {
  const raw = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return [];
  const origins = new Set<string>();
  for (const part of raw.split(",")) {
    try {
      const url = new URL(part.trim());
      if (url.protocol === "https:" || url.protocol === "http:") origins.add(url.origin);
    } catch {
      // ignored: reported below if nothing usable is left
    }
  }
  if (origins.size === 0) console.warn(`NEXT_PUBLIC_SITE_URL is set but is not a valid http(s) URL ("${raw}"), so the CSRF origin allowlist is off.`);
  return [...origins];
}

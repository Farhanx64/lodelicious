/**
 * Redirects answered at the Worker's front door, before Next (security audit 2026-11-26).
 *
 * - Plain http → https. Cloudflare tells the Worker the visitor's real scheme in the `cf-visitor`
 *   header ({"scheme":"http"}). Not `x-forwarded-proto`: behind Cloudflare that says http on every
 *   request, and a rule on it looped HTTPS to itself (2026-11-20). No header, no redirect.
 * - www. → the apex, including the bare root (Next's `/:path*` rule sent `/` to a literal
 *   "/:path*" on Workers).
 *
 * Only the shop's own hosts are touched, so workers.dev and local previews behave as before.
 * Plain JavaScript with no imports: the Worker entry loads it directly, and unit tests import it.
 */
export const CANONICAL_HOST = "shoplodelicious.com";
const HOSTS = new Set([CANONICAL_HOST, `www.${CANONICAL_HOST}`]);

/** The visitor's scheme from Cloudflare's `cf-visitor` header, or null when it is missing or unreadable. */
export function visitorScheme(header) {
  if (!header) return null;
  try {
    const scheme = JSON.parse(header)?.scheme;
    return scheme === "http" || scheme === "https" ? scheme : null;
  } catch {
    return null;
  }
}

/**
 * The redirect to answer with, or null to let the app handle the request.
 * @param {Request} request
 * @returns {Response | null}
 */
export function edgeRedirect(request) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;
  const toHttps = visitorScheme(request.headers.get("cf-visitor")) === "http";
  const toApex = host !== CANONICAL_HOST;
  if (!toHttps && !toApex) return null;
  const location = `https://${CANONICAL_HOST}${url.pathname}${url.search}`;
  // 301 for page loads; 308 keeps the method and body of anything else.
  const status = request.method === "GET" || request.method === "HEAD" ? 301 : 308;
  return new Response(null, { status, headers: { Location: location, "Cache-Control": "max-age=3600" } });
}

import type { MetadataRoute } from "next";

import { isPreviewEnv } from "@/src/lib/app-env";

// Read APP_ENV on each request. Without this Next builds robots.txt once, so a build made in a shell
// with a different APP_ENV (CI, or the local .env) would fix the wrong rules into the live site (D41).
export const dynamic = "force-dynamic";

/** Staging previews must never be indexed; production allows the storefront but not the admin. */
export default function robots(): MetadataRoute.Robots {
  if (isPreviewEnv()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/ops"] } };
}

import type { MetadataRoute } from "next";

import { isPreviewEnv } from "@/src/lib/app-env";

/** Staging previews must never be indexed; production allows the storefront but not the admin. */
export default function robots(): MetadataRoute.Robots {
  if (isPreviewEnv()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/ops"] } };
}

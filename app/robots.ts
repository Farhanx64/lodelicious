import type { MetadataRoute } from "next";

/** Staging previews must never be indexed; production allows the storefront but not the admin. */
export default function robots(): MetadataRoute.Robots {
  if (process.env.APP_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/ops"] } };
}

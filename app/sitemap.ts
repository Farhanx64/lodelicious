import type { MetadataRoute } from "next";

import { isPreviewEnv } from "@/src/lib/app-env";
import { listProducts } from "@/src/lib/catalog/queries";
import { absoluteUrl } from "@/src/lib/seo";
import { OCCASIONS } from "@/src/lib/seo/occasions";

// Built per request, like robots.txt: products change in the admin and the sitemap must follow (D68).
export const dynamic = "force-dynamic";

const STATIC: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/gift-baskets", priority: 0.9, changeFrequency: "weekly" },
  { path: "/build-a-basket", priority: 0.9, changeFrequency: "weekly" },
  { path: "/shop", priority: 0.8, changeFrequency: "daily" },
  { path: "/gift-basket-delivery", priority: 0.8, changeFrequency: "monthly" },
  { path: "/corporate-gifts", priority: 0.7, changeFrequency: "monthly" },
  { path: "/baby-gifts", priority: 0.7, changeFrequency: "weekly" },
  { path: "/events", priority: 0.6, changeFrequency: "monthly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
  { path: "/policies", priority: 0.3, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isPreviewEnv()) return [];
  const products = await listProducts({ limit: 1000 });
  return [
    ...STATIC.map((s) => ({ url: absoluteUrl(s.path), changeFrequency: s.changeFrequency, priority: s.priority })),
    ...OCCASIONS.map((o) => ({ url: absoluteUrl(`/gift-baskets/${o.slug}`), changeFrequency: "weekly" as const, priority: 0.85 })),
    ...products
      .filter((p) => p.slug)
      .map((p) => ({ url: absoluteUrl(`/shop/${p.slug}`), lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}

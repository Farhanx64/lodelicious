/**
 * Reviews for the home page (D52). Framework-free: takes the Payload instance, so tests drive the
 * exact code the page runs. Read as a member of the public (access checks on).
 */
import type { Payload } from "payload";

import type { Review } from "@/payload-types";

import { CAROUSEL_LIMIT, type PublicReview } from "./shared";

export function toPublicReview(r: Pick<Review, "id" | "name" | "rating" | "text" | "date">): PublicReview {
  const rating = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5)));
  return { id: String(r.id), name: r.name.trim(), rating, text: r.text.trim(), date: r.date ? r.date.slice(0, 10) : null };
}

/** Featured reviews first, then the newest. */
export async function listReviews(payload: Payload, limit: number = CAROUSEL_LIMIT): Promise<PublicReview[]> {
  const { docs } = await payload.find({
    collection: "reviews",
    sort: ["-featured", "-date", "-createdAt"],
    limit,
    depth: 0,
    overrideAccess: false,
  });
  return docs.map(toPublicReview).filter((r) => r.name && r.text);
}

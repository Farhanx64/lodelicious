"use server";

import config from "@payload-config";
import { getPayload } from "payload";

import { getProduct } from "@/src/lib/catalog/queries";
import { TOO_MANY_ATTEMPTS } from "@/src/lib/rate-limit";
import { isRateLimited } from "@/src/lib/rate-limit-server";
import { echoReviewValues, submitProductReview, type ReviewFormState } from "@/src/lib/reviews/product-reviews";

/**
 * A customer's review of a product (D69). Saved as waiting for approval; nothing is shown until staff
 * approve it. Rate limited per visitor like the other forms (D41), and the product is looked up
 * again from its slug, so only a product customers can see can be reviewed.
 */
export async function submitReview(_prev: ReviewFormState, form: FormData): Promise<ReviewFormState> {
  const raw = Object.fromEntries(form);
  if (await isRateLimited("review")) return { error: TOO_MANY_ATTEMPTS, values: echoReviewValues(raw) };
  const slug = typeof raw.product === "string" ? raw.product.slice(0, 200) : "";
  const product = slug ? await getProduct(slug) : null;
  return submitProductReview(await getPayload({ config }), product, raw);
}

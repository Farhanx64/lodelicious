"use server";

import { loadBuilderCatalog } from "@/src/lib/catalog/builder-data";
import { catalogOf, validateGift, type GiftValidation } from "@/src/lib/gifts";
import { parseCustomRequest } from "@/src/lib/gifts/request";

/**
 * Server-authoritative re-check with fresh prices, stock and rules — the browser's live preview
 * is never trusted. Milestone 4's add-to-cart and checkout run this same validation.
 */
export async function checkBasket(input: unknown): Promise<GiftValidation | { error: string }> {
  const request = parseCustomRequest(input);
  if (!request) return { error: "That basket couldn't be read. Please refresh the page and try again." };
  const { settings, products } = await loadBuilderCatalog();
  return validateGift(request, settings, catalogOf(products));
}

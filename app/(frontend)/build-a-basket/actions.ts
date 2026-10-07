"use server";

import { redirect } from "next/navigation";

import { loadBuilderCatalog } from "@/src/lib/catalog/builder-data";
import { failedWith, type FormState } from "@/src/lib/checkout/form-state";
import { reserveBasket } from "@/src/lib/checkout/service";
import { checkoutPayload, clearBasketDraft, readBasketDraft, saveBasketDraft } from "@/src/lib/checkout/session";
import { catalogOf, validateGift, type GiftValidation } from "@/src/lib/gifts";
import { parseCustomRequest } from "@/src/lib/gifts/request";
import { TOO_MANY_ATTEMPTS } from "@/src/lib/rate-limit";
import { isRateLimited } from "@/src/lib/rate-limit-server";

/**
 * Server-authoritative re-check with fresh prices, stock and rules — the browser's live preview
 * is never trusted. Milestone 4's add-to-cart and checkout run this same validation.
 */
export async function checkBasket(input: unknown): Promise<GiftValidation | { error: string }> {
  if (await isRateLimited("checkBasket")) return { error: TOO_MANY_ATTEMPTS };
  const request = parseCustomRequest(input);
  if (!request) return { error: "That basket couldn't be read. Please refresh the page and try again." };
  const { settings, products } = await loadBuilderCatalog();
  return validateGift(request, settings, catalogOf(products));
}

/**
 * Baskets are reserved, not added to the bag (D36): re-check the basket, keep it in a signed
 * cookie and continue to the reservation form.
 */
export async function startReservation(input: { request: unknown; message: unknown; requests: unknown }): Promise<{ error: string }> {
  if (await isRateLimited("startReservation")) return { error: TOO_MANY_ATTEMPTS };
  const request = parseCustomRequest(input.request);
  if (!request) return { error: "That basket couldn't be read. Please refresh the page and try again." };
  const { settings, products } = await loadBuilderCatalog();
  const result = validateGift(request, settings, catalogOf(products));
  if (!result.complete) return { error: result.violations[0]?.message ?? "Please finish your basket first." };
  await saveBasketDraft({ request, message: String(input.message ?? "").slice(0, 300), requests: String(input.requests ?? "").slice(0, 500) });
  redirect("/reserve");
}

export type ReserveState = FormState;

export async function submitReservation(_prev: ReserveState, form: FormData): Promise<ReserveState> {
  if (await isRateLimited("submitReservation")) return failedWith(TOO_MANY_ATTEMPTS, form);
  const draft = await readBasketDraft();
  if (!draft) return failedWith("Your basket has expired. Please build it again.", form);
  const { payload, ctx } = await checkoutPayload();
  const result = await reserveBasket(payload, { draft, form: Object.fromEntries(form) }, ctx);
  if (!result.ok) return failedWith(result.error, form);
  await clearBasketDraft();
  redirect(`/reservation/${result.number}?t=${encodeURIComponent(result.token)}`);
}

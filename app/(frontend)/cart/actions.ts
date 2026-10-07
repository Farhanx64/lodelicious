"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { failedWith, type FormState as CheckoutFormState } from "@/src/lib/checkout/form-state";
import { changeBag, placeOrder } from "@/src/lib/checkout/service";
import { bagToken, checkoutPayload, ensureBagToken } from "@/src/lib/checkout/session";
import { TOO_MANY_ATTEMPTS } from "@/src/lib/rate-limit";
import { isRateLimited } from "@/src/lib/rate-limit-server";

export type FormState = CheckoutFormState;

/** Public actions answer with the customer's entries kept (A13) and are rate limited per visitor (A15). */
export async function addToBag(_prev: FormState, form: FormData): Promise<FormState> {
  if (await isRateLimited("addToBag")) return failedWith(TOO_MANY_ATTEMPTS, form);
  const { payload, ctx } = await checkoutPayload();
  const token = await ensureBagToken();
  const result = await changeBag(payload, token, { unitId: String(form.get("unitId") ?? ""), quantity: Number(form.get("quantity") ?? 1), mode: "add" }, ctx);
  if (!result.ok) return failedWith(result.error, form);
  revalidatePath("/", "layout");
  redirect("/cart");
}

export async function updateBagLine(form: FormData): Promise<void> {
  const { payload, ctx } = await checkoutPayload();
  const token = await bagToken();
  if (!token) return;
  const quantity = form.get("remove") ? 0 : Number(form.get("quantity") ?? 0);
  await changeBag(payload, token, { unitId: String(form.get("unitId") ?? ""), quantity, mode: "set" }, ctx);
  revalidatePath("/", "layout");
}

export async function submitOrder(_prev: FormState, form: FormData): Promise<FormState> {
  if (await isRateLimited("submitOrder")) return failedWith(TOO_MANY_ATTEMPTS, form);
  const { payload, ctx } = await checkoutPayload();
  const result = await placeOrder(payload, { cartToken: await bagToken(), form: Object.fromEntries(form) }, ctx);
  if (!result.ok) return failedWith(result.error, form);
  revalidatePath("/", "layout");
  redirect(`/order/${result.number}?t=${encodeURIComponent(result.token)}`);
}

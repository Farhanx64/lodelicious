import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { submitOrder } from "@/app/(frontend)/cart/actions";
import { ActionForm } from "@/components/checkout/ActionForm";
import { ContactFields } from "@/components/checkout/ContactFields";
import { PickupSelect } from "@/components/checkout/PickupSelect";
import { field, label } from "@/components/checkout/styles";
import { Summary, TestModeNote } from "@/components/checkout/Summary";
import { PolicyLinks } from "@/components/policies/PolicyLinks";
import { availableSlots } from "@/src/lib/checkout/pickup";
import { priceBag } from "@/src/lib/checkout/service";
import { bagToken, checkoutPayload } from "@/src/lib/checkout/session";
import { orderingState } from "@/src/lib/payments";
import { telHref } from "@/src/lib/phone";
import { getStoreSettings } from "@/src/lib/store";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const [{ payload, ctx }, store] = await Promise.all([checkoutPayload(), getStoreSettings()]);
  const bag = await priceBag(payload, await bagToken(), ctx);
  if (bag.payable.length === 0 || bag.blocking) redirect("/cart");
  const state = orderingState(ctx.provider, bag.taxApproved);
  const slots = availableSlots(ctx.pickup, new Date());

  return (
    <div className="mx-auto w-[min(100%-2rem,60rem)]">
      <h1 className="mb-6 text-[clamp(1.75rem,5vw,2.5rem)]">Checkout</h1>
      {ctx.provider?.test && <TestModeNote />}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          {state.open ? (
            <ActionForm action={submitOrder} submitLabel={ctx.provider?.test ? "Place test order" : "Place order"} pendingLabel="Placing order…" disabled={slots.length === 0}>
              <ContactFields prefix="checkout" />
              <fieldset className="mb-4">
                <legend className="mb-3 font-display text-xl text-gold-text">Pickup</legend>
                <p className="mb-3 text-sm">
                  At {store.street}, {store.locality}. Local delivery is through DoorDash.
                </p>
                <PickupSelect slots={slots} id="checkout-pickup" />
                <label htmlFor="checkout-notes" className={label}>
                  Notes for the shop (optional)
                </label>
                <textarea id="checkout-notes" name="notes" maxLength={500} rows={3} className={field} />
              </fieldset>
            </ActionForm>
          ) : (
            <p className="border-l-4 border-gold bg-paper p-4">
              Online payment is coming soon. To order today, call <a href={telHref(store.phone)}>{store.phone}</a> or visit us at {store.street},{" "}
              {store.locality}.
            </p>
          )}
          <PolicyLinks action="order" />
        </div>
        <Summary
          lines={bag.payable.map((l) => ({ key: l.unitId, title: l.title, detail: l.optionLabel, quantity: l.quantity, totalCents: l.lineTotalCents }))}
          subtotalCents={bag.subtotalCents}
          taxCents={bag.taxCents}
          totalCents={bag.totalCents}
          taxApproved={bag.taxApproved}
        />
      </div>
    </div>
  );
}

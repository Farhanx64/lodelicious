import type { Metadata } from "next";
import Link from "next/link";

import { submitReservation } from "@/app/(frontend)/build-a-basket/actions";
import { ActionForm } from "@/components/checkout/ActionForm";
import { ContactFields } from "@/components/checkout/ContactFields";
import { PaymentChoice } from "@/components/checkout/FormFields";
import { PickupSelect } from "@/components/checkout/PickupSelect";
import { SubmissionField } from "@/components/checkout/SubmissionField";
import { primaryButton } from "@/components/checkout/styles";
import { Summary, TestModeNote } from "@/components/checkout/Summary";
import { PolicyLinks } from "@/components/policies/PolicyLinks";
import { paymentPlan } from "@/src/lib/checkout/deposit";
import { availableSlots } from "@/src/lib/checkout/pickup";
import { priceBasket } from "@/src/lib/checkout/service";
import { checkoutPayload, readBasketDraft } from "@/src/lib/checkout/session";
import { formatCents } from "@/src/lib/money";
import { orderingState } from "@/src/lib/payments";
import { telHref } from "@/src/lib/phone";
import { getStoreSettings } from "@/src/lib/store";

export const metadata: Metadata = { title: "Reserve your basket", robots: { index: false } };

export default async function ReservePage() {
  const [draft, { payload, ctx }, store] = await Promise.all([readBasketDraft(), checkoutPayload(), getStoreSettings()]);
  const basket = draft ? await priceBasket(payload, draft, ctx) : null;

  if (!draft || !basket || !basket.ok) {
    return (
      <div className="mx-auto w-[min(100%-2rem,40rem)] py-6 text-center">
        <h1 className="mb-4 text-[clamp(1.75rem,5vw,2.5rem)]">Reserve your basket</h1>
        <p className="mb-6 text-lg">{basket && !basket.ok ? basket.error : "Build your basket first, then reserve it here."}</p>
        <Link href="/build-a-basket" className={primaryButton}>
          Build a basket
        </Link>
      </div>
    );
  }

  const deposit = paymentPlan(basket.totalCents, ctx.deposit, false);
  const slots = availableSlots(ctx.pickup, new Date(), ctx.reservationLeadHours);
  const state = orderingState(ctx.provider, basket.taxApproved);
  const depositLabel = ctx.deposit.type === "percent" ? `${ctx.deposit.percentBasisPoints / 100}% deposit` : "Deposit";

  return (
    <div className="mx-auto w-[min(100%-2rem,60rem)]">
      <h1 className="mb-2 text-[clamp(1.75rem,5vw,2.5rem)]">Reserve your basket</h1>
      <p className="mb-6 max-w-[60ch]">
        Custom baskets are made to order. A deposit reserves yours; the rest is paid when you pick it up. We&rsquo;ll be in touch if anything needs
        confirming.
      </p>
      {ctx.provider?.test && <TestModeNote />}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          {state.open ? (
            <ActionForm action={submitReservation} submitLabel={ctx.provider?.test ? "Reserve with test payment" : "Reserve and pay"} pendingLabel="Reserving…" disabled={slots.length === 0}>
              <SubmissionField kind="reservation" />
              <ContactFields prefix="reserve" />
              <fieldset className="mb-4">
                <legend className="mb-3 font-display text-xl text-gold-text">Pickup</legend>
                <p className="mb-3 text-sm">
                  Baskets need at least {ctx.reservationLeadHours} hours&rsquo; notice. Pickup at {store.street}, {store.locality}.
                </p>
                <PickupSelect slots={slots} id="reserve-pickup" />
              </fieldset>
              <PaymentChoice
                depositLabel={depositLabel}
                chargeNowText={formatCents(deposit.chargeNowCents)}
                balanceDueText={formatCents(deposit.balanceDueCents)}
                fullText={ctx.allowPayInFull ? formatCents(basket.totalCents) : undefined}
              />
            </ActionForm>
          ) : (
            <p className="border-l-4 border-gold bg-paper p-4">
              Online reservations are coming soon. To reserve this basket, call <a href={telHref(store.phone)}>{store.phone}</a>.
            </p>
          )}
          <PolicyLinks action="reserve" />
        </div>
        <div>
          <Summary
            lines={[
              ...basket.components.map((c) => ({ key: c.productId, title: c.name, quantity: c.quantity, totalCents: c.unitPriceCents * c.quantity })),
              { key: "packaging", title: `Basket & packaging (${basket.basketSizeIn}")`, quantity: 1, totalCents: basket.packagingCents },
            ]}
            subtotalCents={basket.subtotalCents}
            taxCents={basket.taxCents}
            totalCents={basket.totalCents}
            taxApproved={basket.taxApproved}
          />
          {draft.message && <p className="mt-4 text-sm">Gift message: &ldquo;{draft.message}&rdquo;</p>}
          {draft.requests && <p className="mt-2 text-sm">Requests: {draft.requests} (we&rsquo;ll confirm these with you)</p>}
          {store.allergyNotice && <p className="mt-4 border-l-4 border-gold bg-paper p-3 text-sm">{store.allergyNotice}</p>}
          <p className="mt-4">
            <Link href="/build-a-basket">Change basket</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

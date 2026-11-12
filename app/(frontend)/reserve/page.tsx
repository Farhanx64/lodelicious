import type { Metadata } from "next";
import Link from "next/link";

import { submitReservation } from "@/app/(frontend)/build-a-basket/actions";
import { ActionForm } from "@/components/checkout/ActionForm";
import { CardFields } from "@/components/checkout/CardFields";
import {
  card,
  CheckoutTopBar,
  ItemCard,
  leftColumn,
  LockIcon,
  OrderSummarySection,
  panelGrid,
  PayTotals,
  PolicyLine,
  rightColumn,
  TotalsCard,
} from "@/components/checkout/CheckoutLayout";
import { ContactFields } from "@/components/checkout/ContactFields";
import { PaymentChoice } from "@/components/checkout/FormFields";
import { FulfillmentChoice } from "@/components/checkout/FulfillmentChoice";
import { PickupSelect } from "@/components/checkout/PickupSelect";
import { ShippingAddressFields } from "@/components/checkout/ShippingFields";
import { SubmissionField } from "@/components/checkout/SubmissionField";
import { primaryButton } from "@/components/checkout/styles";
import { TestModeNote } from "@/components/checkout/Summary";
import { paymentPlan } from "@/src/lib/checkout/deposit";
import { availableSlots } from "@/src/lib/checkout/pickup";
import { bagLineLooks } from "@/src/lib/checkout/presentation";
import { priceBasket } from "@/src/lib/checkout/service";
import { checkoutPayload, readBasketDraft } from "@/src/lib/checkout/session";
import { describeTax } from "@/src/lib/checkout/tax";
import { formatCents } from "@/src/lib/money";
import { orderingState } from "@/src/lib/payments";
import { telHref } from "@/src/lib/phone";
import { getStoreSettings } from "@/src/lib/store";

export const metadata: Metadata = { title: "Reserve your basket", robots: { index: false } };

export default async function ReservePage({ searchParams }: { searchParams: Promise<{ method?: string | string[] }> }) {
  const [draft, { payload, ctx }, store, query] = await Promise.all([readBasketDraft(), checkoutPayload(), getStoreSettings(), searchParams]);
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

  // Pickup unless the customer chose shipping and every item in the basket can ship (D54). A shipped basket is paid in full.
  const method = query.method === "ship" && basket.shipping.available ? "ship" : "pickup";
  const shippingCents = method === "ship" && basket.shipping.available ? basket.shipping.cents : 0;
  const grandTotal = basket.totalCents + shippingCents;
  const deposit = paymentPlan(basket.totalCents, ctx.deposit, false);
  const slots = availableSlots(ctx.pickup, new Date(), ctx.reservationLeadHours);
  const state = orderingState(ctx.provider, basket.taxApproved);
  const depositLabel = ctx.deposit.type === "percent" ? `${ctx.deposit.percentBasisPoints / 100}% deposit` : "Deposit";
  const looks = await bagLineLooks(
    payload,
    basket.components.map((c) => c.productId.split(":")[0]),
  );
  const itemCount = basket.components.reduce((n, c) => n + c.quantity, 0);

  const summary = (
    <div className={leftColumn}>
      <CheckoutTopBar back={{ href: "/build-a-basket", label: "Build a basket" }} current="Reserve" />
      <p className="mb-6 max-w-[60ch] text-sm">
        Custom baskets are made to order. A deposit reserves yours; the rest is paid when you pick it up. We&rsquo;ll be in touch if anything needs
        confirming.
      </p>
      <OrderSummarySection heading="Your basket" count={itemCount} totalCents={grandTotal}>
        <ul className="mb-4 space-y-3">
          {basket.components.map((c) => {
            const look = looks.get(c.productId.split(":")[0]);
            return (
              <ItemCard
                key={c.productId}
                title={c.name}
                detail={look?.category ?? null}
                quantity={c.quantity}
                totalCents={c.unitPriceCents * c.quantity}
                image={look?.image ?? null}
              />
            );
          })}
          <ItemCard title={`Basket & packaging (${basket.basketSizeIn}")`} quantity={1} totalCents={basket.packagingCents} />
        </ul>
        <TotalsCard
          subtotalCents={basket.subtotalCents}
          taxCents={basket.taxCents}
          totalCents={grandTotal}
          taxApproved={basket.taxApproved}
          taxNote={describeTax(basket.taxClasses, basket.taxApproved)}
          shipping={{ method, cents: shippingCents }}
        />
        <p className="mt-3">
          <Link href="/build-a-basket" className="inline-flex min-h-11 items-center">
            Change basket
          </Link>
        </p>
      </OrderSummarySection>
      {(draft.message || draft.requests) && (
        <div className={`${card} mt-4 p-4 text-sm`}>
          {draft.message && <p>Gift message: &ldquo;{draft.message}&rdquo;</p>}
          {draft.requests && <p className={draft.message ? "mt-2" : undefined}>Requests: {draft.requests} (we&rsquo;ll confirm these with you)</p>}
        </div>
      )}
      {store.allergyNotice && <p className="mt-4 rounded-lg border-l-4 border-gold bg-paper p-3 text-sm">{store.allergyNotice}</p>}
    </div>
  );

  return (
    <div className="mx-auto w-full md:w-[min(100%-2rem,76rem)]">
      <h1 className="sr-only">Reserve your basket</h1>
      {ctx.provider?.test && (
        <div className="mx-4 md:mx-0">
          <TestModeNote />
        </div>
      )}
      {state.open ? (
        <ActionForm
          action={submitReservation}
          submitLabel={ctx.provider?.test ? "Reserve with test payment" : method === "ship" ? `Pay ${formatCents(grandTotal)}` : "Reserve and pay"}
          submitIcon={<LockIcon />}
          pendingLabel="Reserving…"
          disabled={method === "pickup" && slots.length === 0}
          aside={summary}
          wrapperClassName={panelGrid}
          formClassName={rightColumn}
          stickySubmit
          beforeSubmit={
            <PayTotals
              subtotalCents={basket.subtotalCents}
              totalCents={grandTotal}
              rows={
                method === "ship"
                  ? [{ label: "Paid in full now (shipped baskets)", value: formatCents(grandTotal) }]
                  : [
                      { label: `${depositLabel} now`, value: formatCents(deposit.chargeNowCents) },
                      { label: "Balance at pickup", value: formatCents(deposit.balanceDueCents) },
                    ]
              }
            />
          }
          afterSubmit={<PolicyLine />}
        >
          <SubmissionField kind="reservation" />
          <FulfillmentChoice path="/reserve" method={method} shipping={basket.shipping} />
          <ContactFields prefix="reserve" />
          {method === "ship" ? (
            <>
              <p className="mb-3 text-sm">We make your basket, then ship it. A shipped basket is paid in full now: {formatCents(grandTotal)}.</p>
              <ShippingAddressFields prefix="reserve" />
            </>
          ) : (
            <>
              <fieldset className="mb-6">
                <legend className="mb-3 text-base font-semibold text-ink">Pickup</legend>
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
            </>
          )}
          <CardFields config={ctx.provider?.browser ?? { kind: "test" }} />
        </ActionForm>
      ) : (
        <div className={panelGrid}>
          {summary}
          <div className={rightColumn}>
            <p className="rounded-lg border-l-4 border-gold bg-ivory p-4">
              Online reservations are coming soon. To reserve this basket, call <a href={telHref(store.phone)}>{store.phone}</a>.
            </p>
            <PolicyLine />
          </div>
        </div>
      )}
    </div>
  );
}

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
import { ExpectedCharge, ForShipTax, ShipTaxProvider, ShipTaxText, ShipToState } from "@/components/checkout/ShipTax";
import { ShippingAddressFields } from "@/components/checkout/ShippingFields";
import { SubmissionField } from "@/components/checkout/SubmissionField";
import { primaryButton } from "@/components/checkout/styles";
import { TestModeNote } from "@/components/checkout/Summary";
import { paymentPlan } from "@/src/lib/checkout/deposit";
import { availableSlots } from "@/src/lib/checkout/pickup";
import { bagLineLooks } from "@/src/lib/checkout/presentation";
import { priceBasket } from "@/src/lib/checkout/service";
import { checkoutPayload, readBasketDraft } from "@/src/lib/checkout/session";
import { taxLabelFor } from "@/src/lib/checkout/ship-tax";
import { basketTaxViews, byView } from "@/src/lib/checkout/tax-views";
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
  const deposit = paymentPlan(basket.totalCents, ctx.deposit, false);
  const slots = availableSlots(ctx.pickup, new Date(), ctx.reservationLeadHours);
  const state = orderingState(ctx.provider, basket.taxApproved);
  // Sales tax follows the ship-to state (D65): a shipped basket is worked out for every state in
  // "Tax by ship-to state" and for "no sales tax"; pickup is the one version it always was.
  const views = basketTaxViews(basket, { method, shippingCents, rules: ctx.shipTaxRules, deposit, allowPayInFull: ctx.allowPayInFull }).map((v) => ({
    ...v,
    taxLabel:
      v.basis.kind === "none" ? (
        <>
          No sales tax (ships to <ShipToState />)
        </>
      ) : v.basis.kind === "state" ? (
        taxLabelFor(v.basis, v.basket.taxApproved)
      ) : undefined,
  }));
  const first = views[0];
  const byKey = <T,>(pick: (v: (typeof views)[number]) => T) => byView(views, pick);
  const grandTotal = first.grandTotal;
  const totalText = <ShipTaxText texts={byKey((v) => formatCents(v.grandTotal))} />;
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
      <OrderSummarySection heading="Your basket" count={itemCount} totalCents={grandTotal} totalLabel={totalText}>
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
        {views.map((v) => (
          <ForShipTax key={v.key} variant={v.key}>
            <TotalsCard
              subtotalCents={v.basket.subtotalCents}
              taxCents={v.basket.taxCents}
              totalCents={v.grandTotal}
              taxApproved={v.basket.taxApproved}
              taxNote={v.taxNote}
              taxLabel={v.taxLabel}
              shipping={{ method, cents: shippingCents }}
            />
          </ForShipTax>
        ))}
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

  const page = (
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
          submitLabels={ctx.provider?.test || method !== "ship" ? undefined : byKey((v) => `Pay ${formatCents(v.grandTotal)}`)}
          submitIcon={<LockIcon />}
          pendingLabel="Reserving…"
          disabled={method === "pickup" && slots.length === 0}
          aside={summary}
          wrapperClassName={panelGrid}
          formClassName={rightColumn}
          stickySubmit
          beforeSubmit={views.map((v) => (
            <ForShipTax key={v.key} variant={v.key}>
              <PayTotals
                subtotalCents={v.basket.subtotalCents}
                totalCents={v.grandTotal}
                rows={
                  method === "ship"
                    ? [{ label: "Paid in full now (shipped baskets)", value: formatCents(v.grandTotal) }]
                    : [
                        { label: `${depositLabel} now`, value: formatCents(deposit.chargeNowCents) },
                        { label: "Balance at pickup", value: formatCents(deposit.balanceDueCents) },
                      ]
                }
              />
            </ForShipTax>
          ))}
          afterSubmit={<PolicyLine />}
        >
          <SubmissionField kind="reservation" />
          <FulfillmentChoice path="/reserve" method={method} shipping={basket.shipping} />
          <ContactFields prefix="reserve" />
          {method === "ship" ? (
            <>
              <p className="mb-3 text-sm">We make your basket, then ship it. A shipped basket is paid in full now: {totalText}.</p>
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
          <ExpectedCharge amounts={byKey((v) => v.wallet)} />
          <CardFields config={ctx.provider?.browser ?? { kind: "test" }} walletAmount={first.wallet} walletAmounts={byKey((v) => v.wallet)} />
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
  // Shipped: the totals follow the state chosen in the address (D65).
  return method === "ship" ? <ShipTaxProvider listed={ctx.shipTaxRules.map((r) => r.state)}>{page}</ShipTaxProvider> : page;
}

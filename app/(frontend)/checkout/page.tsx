import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { submitOrder } from "@/app/(frontend)/cart/actions";
import { ProductImage } from "@/components/catalog/ProductImage";
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
import { NotesField } from "@/components/checkout/FormFields";
import { FulfillmentChoice } from "@/components/checkout/FulfillmentChoice";
import { AddOnButton, QtyStepper, RemoveLine } from "@/components/checkout/OrderSummaryParts";
import { PickupSelect } from "@/components/checkout/PickupSelect";
import { ExpectedCharge, ForShipTax, ShipTaxProvider, ShipTaxText, ShipToState } from "@/components/checkout/ShipTax";
import { ShippingAddressFields } from "@/components/checkout/ShippingFields";
import { SubmissionField } from "@/components/checkout/SubmissionField";
import { TestModeNote } from "@/components/checkout/Summary";
import { RewardChoice } from "@/components/rewards/RewardChoice";
import { availableSlots } from "@/src/lib/checkout/pickup";
import { bagLineLooks, suggestAddOn } from "@/src/lib/checkout/presentation";
import { priceBagForCheckout } from "@/src/lib/checkout/service";
import { bagToken, checkoutPayload } from "@/src/lib/checkout/session";
import { taxLabelFor, type TaxBasis } from "@/src/lib/checkout/ship-tax";
import { bagTaxViews, byView } from "@/src/lib/checkout/tax-views";
import { formatCents } from "@/src/lib/money";
import { orderingState } from "@/src/lib/payments";
import { telHref } from "@/src/lib/phone";
import { affordableOptions, formatPoints, pointsFor } from "@/src/lib/rewards/program";
import { currentMember } from "@/src/lib/rewards/session";
import { getStoreSettings } from "@/src/lib/store";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

const FORM_ID = "checkout-form";

/** The tax row's label for a shipped order (D65); pickup keeps the plain "Tax". */
function taxLabelNode(basis: TaxBasis, approved: boolean): React.ReactNode {
  if (basis.kind === "none") {
    return (
      <>
        No sales tax (ships to <ShipToState />)
      </>
    );
  }
  return basis.kind === "state" ? taxLabelFor(basis, approved) : undefined;
}

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ method?: string | string[] }> }) {
  const [{ payload, ctx }, store, query] = await Promise.all([checkoutPayload(), getStoreSettings(), searchParams]);
  const { bag, shipping } = await priceBagForCheckout(payload, await bagToken(), ctx);
  if (bag.payable.length === 0 || bag.blocking) redirect("/cart");
  // Pickup unless the customer chose shipping and this bag can ship (D54).
  const method = query.method === "ship" && shipping.available ? "ship" : "pickup";
  const shippingCents = method === "ship" && shipping.available ? shipping.cents : 0;
  const state = orderingState(ctx.provider, bag.taxApproved);
  const slots = availableSlots(ctx.pickup, new Date());
  const [member, looks, addOn] = await Promise.all([
    ctx.rewards.active ? currentMember() : null,
    bagLineLooks(payload, bag.payable.map((l) => l.productId)),
    // Only offered while the customer can actually pay here.
    state.open ? suggestAddOn(payload, bag) : null,
  ]);
  const affordable = member ? affordableOptions(ctx.rewards.config.options, member.pointsBalance, bag.subtotalCents) : [];
  // Sales tax follows the ship-to state (D65). A shipped bag is worked out for every state in "Tax by
  // ship-to state" and for "no sales tax"; the page shows the one for the state chosen in the address.
  // Pickup is the one version it always was. The server recomputes it from the submitted address.
  const views = bagTaxViews(bag, { method, shippingCents, rules: ctx.shipTaxRules, rewards: affordable }).map((v) => ({ ...v, taxLabel: taxLabelNode(v.basis, v.bag.taxApproved) }));
  const first = views[0];
  const byKey = <T,>(pick: (v: (typeof views)[number]) => T) => byView(views, pick);
  const totalCents = first.totalCents;
  const rewardOptions = first.rewards.map((o) => ({ id: o.id, label: o.label, labels: byKey((v) => v.rewards.find((r) => r.id === o.id)?.label ?? o.label) }));
  const payLabel = (cents: number) => (ctx.provider?.test ? `Place test order · ${formatCents(cents)}` : `Pay ${formatCents(cents)}`);
  const earn = member ? pointsFor(bag.subtotalCents, ctx.rewards.config.pointsPerDollar) : 0;
  const returnPath = method === "ship" ? "/checkout?method=ship" : "/checkout";

  const summary = (
    <div className={leftColumn}>
      <CheckoutTopBar back={{ href: "/cart", label: "Bag" }} current="Checkout" />
      <OrderSummarySection heading="Order summary" count={bag.itemCount} totalCents={totalCents} totalLabel={<ShipTaxText texts={byKey((v) => formatCents(v.totalCents))} />}>
        <ul className="mb-4 space-y-3">
          {bag.payable.map((l) => {
            const look = looks.get(l.productId);
            return (
              <ItemCard
                key={l.unitId}
                title={l.title}
                detail={[look?.category, l.optionLabel].filter(Boolean).join(" · ") || null}
                quantity={l.quantity}
                totalCents={l.lineTotalCents}
                image={look?.image ?? null}
                note={l.problem ? <p className="text-sm text-ink">{l.problem.message}</p> : null}
                stepper={<QtyStepper unitId={l.unitId} title={l.title} quantity={l.quantity} />}
                remove={<RemoveLine unitId={l.unitId} title={l.title} />}
              />
            );
          })}
        </ul>
        {views.map((v) => (
          <ForShipTax key={v.key} variant={v.key}>
            <TotalsCard
              subtotalCents={v.bag.subtotalCents}
              taxCents={v.bag.taxCents}
              totalCents={v.totalCents}
              taxApproved={v.bag.taxApproved}
              taxNote={v.taxNote}
              taxLabel={v.taxLabel}
              shipping={{ method, cents: shippingCents }}
            />
          </ForShipTax>
        ))}
        {addOn && (
          <section aria-labelledby="addon-heading" className="mt-8">
            <h2 id="addon-heading" className="mb-3 font-sans text-base font-semibold normal-case tracking-normal text-ink">
              You might also like
            </h2>
            <div className={`${card} flex gap-3 p-3 shadow-sm`}>
              <ProductImage media={addOn.image} size="thumb" decorative className="size-20 shrink-0 rounded-lg border border-line" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap justify-between gap-x-3">
                  <p className="font-semibold">{addOn.title}</p>
                  <p className="font-semibold">{formatCents(addOn.priceCents)}</p>
                </div>
                {addOn.blurb && <p className="line-clamp-2 text-sm text-ink-soft">{addOn.blurb}</p>}
                <AddOnButton unitId={addOn.unitId} title={addOn.title} next={returnPath} />
              </div>
            </div>
          </section>
        )}
      </OrderSummarySection>
      {state.open && ctx.rewards.active && (
        <div className={`${card} mt-4 flex gap-3 p-4`}>
          <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-coastal-pale text-coastal-deep">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5">
              <rect x="3" y="7" width="14" height="10" rx="1.5" />
              <path d="M2.5 7h15M10 7v10M10 7c-1.5-3-5-3-4.5-.5C6 8 10 7 10 7Zm0 0c1.5-3 5-3 4.5-.5C14 8 10 7 10 7Z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            {member ? (
              <RewardChoice
                formId={FORM_ID}
                options={rewardOptions}
                balanceLabel={formatPoints(member.pointsBalance)}
                earnLabel={earn > 0 ? `This order earns about ${formatPoints(earn)} once it's paid (fewer if you use a reward).` : null}
              />
            ) : (
              <>
                <p className="font-semibold">{ctx.rewards.config.programName}</p>
                <p className="text-sm">
                  <Link href="/account?next=/checkout">Sign in</Link> or <Link href="/account/join?next=/checkout">join free</Link> to earn points and use
                  rewards on this order.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const page = (
    <div className="mx-auto w-full md:w-[min(100%-2rem,76rem)]">
      <h1 className="sr-only">Checkout</h1>
      {ctx.provider?.test && (
        <div className="mx-4 md:mx-0">
          <TestModeNote />
        </div>
      )}
      {state.open ? (
        <ActionForm
          id={FORM_ID}
          action={submitOrder}
          submitLabel={payLabel(totalCents)}
          submitLabels={byKey((v) => payLabel(v.totalCents))}
          submitIcon={<LockIcon />}
          pendingLabel="Placing order…"
          disabled={method === "pickup" && slots.length === 0}
          aside={summary}
          wrapperClassName={panelGrid}
          formClassName={rightColumn}
          stickySubmit
          beforeSubmit={views.map((v) => (
            <ForShipTax key={v.key} variant={v.key}>
              <PayTotals
                subtotalCents={v.bag.subtotalCents}
                totalCents={v.totalCents}
                rows={[
                  v.key === "none" ? { label: "Sales tax", value: "None" } : { label: "Includes tax", value: formatCents(v.bag.taxCents) },
                  ...(method === "ship" ? [{ label: "Includes shipping", value: formatCents(shippingCents) }] : []),
                ]}
              />
            </ForShipTax>
          ))}
          afterSubmit={<PolicyLine />}
        >
          <SubmissionField kind="order" />
          <FulfillmentChoice path="/checkout" method={method} shipping={shipping} />
          <ContactFields prefix="checkout" defaults={member ? { name: member.name, email: member.email, phone: member.phone } : undefined} />
          {method === "ship" ? (
            <ShippingAddressFields prefix="checkout" />
          ) : (
            <fieldset className="mb-6">
              <legend className="mb-3 text-base font-semibold text-ink">Pickup</legend>
              <p className="mb-3 text-sm">
                At {store.street}, {store.locality}. Local delivery is through DoorDash.
              </p>
              <PickupSelect slots={slots} id="checkout-pickup" />
            </fieldset>
          )}
          <div className="mb-6">
            <NotesField id="checkout-notes" />
            {store.allergyNotice && (
              <p className="mt-3 rounded-lg border-l-4 border-gold bg-ivory p-3 text-sm">
                <strong>Allergies and dietary needs.</strong> {store.allergyNotice} If you add a note above, our team reads your order before it is prepared.
              </p>
            )}
          </div>
          <ExpectedCharge amounts={byKey((v) => v.wallet)} />
          <CardFields config={ctx.provider?.browser ?? { kind: "test" }} walletAmount={first.wallet} walletAmounts={byKey((v) => v.wallet)} />
        </ActionForm>
      ) : (
        <div className={panelGrid}>
          {summary}
          <div className={rightColumn}>
            <p className="rounded-lg border-l-4 border-gold bg-ivory p-4">
              Online payment is coming soon. To order today, call <a href={telHref(store.phone)}>{store.phone}</a> or visit us at {store.street},{" "}
              {store.locality}.
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

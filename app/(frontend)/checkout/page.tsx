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
import { ShippingAddressFields } from "@/components/checkout/ShippingFields";
import { SubmissionField } from "@/components/checkout/SubmissionField";
import { TestModeNote } from "@/components/checkout/Summary";
import { RewardChoice } from "@/components/rewards/RewardChoice";
import { availableSlots } from "@/src/lib/checkout/pickup";
import { bagLineLooks, suggestAddOn } from "@/src/lib/checkout/presentation";
import { priceBagForCheckout } from "@/src/lib/checkout/service";
import { bagToken, checkoutPayload } from "@/src/lib/checkout/session";
import { describeTax } from "@/src/lib/checkout/tax";
import { formatCents } from "@/src/lib/money";
import { orderingState } from "@/src/lib/payments";
import { telHref } from "@/src/lib/phone";
import { affordableOptions, formatPoints, pointsFor, totalsWithDiscount } from "@/src/lib/rewards/program";
import { currentMember } from "@/src/lib/rewards/session";
import { getStoreSettings } from "@/src/lib/store";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

const FORM_ID = "checkout-form";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ method?: string | string[] }> }) {
  const [{ payload, ctx }, store, query] = await Promise.all([checkoutPayload(), getStoreSettings(), searchParams]);
  const { bag, shipping } = await priceBagForCheckout(payload, await bagToken(), ctx);
  if (bag.payable.length === 0 || bag.blocking) redirect("/cart");
  // Pickup unless the customer chose shipping and this bag can ship (D54).
  const method = query.method === "ship" && shipping.available ? "ship" : "pickup";
  const shippingCents = method === "ship" && shipping.available ? shipping.cents : 0;
  const totalCents = bag.totalCents + shippingCents;
  const state = orderingState(ctx.provider, bag.taxApproved);
  const slots = availableSlots(ctx.pickup, new Date());
  const [member, looks, addOn] = await Promise.all([
    ctx.rewards.active ? currentMember() : null,
    bagLineLooks(payload, bag.payable.map((l) => l.productId)),
    // Only offered while the customer can actually pay here.
    state.open ? suggestAddOn(payload, bag) : null,
  ]);
  // Each reward the member can afford, labelled with the total it would leave, worked out the way checkout will (D47).
  const lines = bag.payable.map((l) => ({ amountCents: l.lineTotalCents, taxClass: l.taxClass }));
  const rewardOptions = member
    ? affordableOptions(ctx.rewards.config.options, member.pointsBalance, bag.subtotalCents).map((o) => ({
        id: o.id,
        label: `${formatCents(o.discountCents)} off for ${formatPoints(o.pointsRequired)} (total ${formatCents(totalsWithDiscount(lines, o.discountCents).totalCents)})`,
        // What checkout will charge with this reward: the discounted total plus any shipping.
        chargeCents: totalsWithDiscount(lines, o.discountCents).totalCents + shippingCents,
      }))
    : [];
  // What Apple's sheet shows (D59): the order total, following the reward radio when there is one.
  const applePayAmount = {
    cents: totalCents,
    ...(rewardOptions.length ? { byChoice: { field: "reward", cents: { none: totalCents, ...Object.fromEntries(rewardOptions.map((o) => [o.id, o.chargeCents])) } } } : {}),
  };
  const earn = member ? pointsFor(bag.subtotalCents, ctx.rewards.config.pointsPerDollar) : 0;
  const returnPath = method === "ship" ? "/checkout?method=ship" : "/checkout";

  const summary = (
    <div className={leftColumn}>
      <CheckoutTopBar back={{ href: "/cart", label: "Bag" }} current="Checkout" />
      <OrderSummarySection heading="Order summary" count={bag.itemCount} totalCents={totalCents}>
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
        <TotalsCard
          subtotalCents={bag.subtotalCents}
          taxCents={bag.taxCents}
          totalCents={totalCents}
          taxApproved={bag.taxApproved}
          taxNote={describeTax(
            bag.payable.map((l) => l.taxClass),
            bag.taxApproved,
          )}
          shipping={{ method, cents: shippingCents }}
        />
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
                options={rewardOptions.map(({ id, label }) => ({ id, label }))}
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

  return (
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
          submitLabel={ctx.provider?.test ? `Place test order · ${formatCents(totalCents)}` : `Pay ${formatCents(totalCents)}`}
          submitIcon={<LockIcon />}
          pendingLabel="Placing order…"
          disabled={method === "pickup" && slots.length === 0}
          aside={summary}
          wrapperClassName={panelGrid}
          formClassName={rightColumn}
          stickySubmit
          beforeSubmit={
            <PayTotals
              subtotalCents={bag.subtotalCents}
              totalCents={totalCents}
              rows={[{ label: "Includes tax", value: formatCents(bag.taxCents) }, ...(method === "ship" ? [{ label: "Includes shipping", value: formatCents(shippingCents) }] : [])]}
            />
          }
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
          <CardFields config={ctx.provider?.browser ?? { kind: "test" }} applePay={applePayAmount} />
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
}

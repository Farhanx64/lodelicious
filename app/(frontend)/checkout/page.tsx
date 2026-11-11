import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { submitOrder } from "@/app/(frontend)/cart/actions";
import { ActionForm } from "@/components/checkout/ActionForm";
import { ContactFields } from "@/components/checkout/ContactFields";
import { NotesField } from "@/components/checkout/FormFields";
import { PickupSelect } from "@/components/checkout/PickupSelect";
import { SubmissionField } from "@/components/checkout/SubmissionField";
import { RewardChoice } from "@/components/rewards/RewardChoice";
import { Summary, TestModeNote } from "@/components/checkout/Summary";
import { PolicyLinks } from "@/components/policies/PolicyLinks";
import { availableSlots } from "@/src/lib/checkout/pickup";
import { priceBag } from "@/src/lib/checkout/service";
import { bagToken, checkoutPayload } from "@/src/lib/checkout/session";
import { orderingState } from "@/src/lib/payments";
import { telHref } from "@/src/lib/phone";
import { formatCents } from "@/src/lib/money";
import { affordableOptions, formatPoints, pointsFor, totalsWithDiscount } from "@/src/lib/rewards/program";
import { currentMember } from "@/src/lib/rewards/session";
import { getStoreSettings } from "@/src/lib/store";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const [{ payload, ctx }, store] = await Promise.all([checkoutPayload(), getStoreSettings()]);
  const bag = await priceBag(payload, await bagToken(), ctx);
  if (bag.payable.length === 0 || bag.blocking) redirect("/cart");
  const state = orderingState(ctx.provider, bag.taxApproved);
  const slots = availableSlots(ctx.pickup, new Date());
  const member = ctx.rewards.active ? await currentMember() : null;
  // Each reward the member can afford, labelled with the total it would leave, worked out the way checkout will (D47).
  const lines = bag.payable.map((l) => ({ amountCents: l.lineTotalCents, taxClass: l.taxClass }));
  const rewardOptions = member
    ? affordableOptions(ctx.rewards.config.options, member.pointsBalance, bag.subtotalCents).map((o) => ({
        id: o.id,
        label: `${formatCents(o.discountCents)} off for ${formatPoints(o.pointsRequired)} (total ${formatCents(totalsWithDiscount(lines, o.discountCents).totalCents)})`,
      }))
    : [];
  const earn = member ? pointsFor(bag.subtotalCents, ctx.rewards.config.pointsPerDollar) : 0;

  return (
    <div className="mx-auto w-[min(100%-2rem,60rem)]">
      <h1 className="mb-6 text-[clamp(1.75rem,5vw,2.5rem)]">Checkout</h1>
      {ctx.provider?.test && <TestModeNote />}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          {state.open ? (
            <ActionForm action={submitOrder} submitLabel={ctx.provider?.test ? "Place test order" : "Place order"} pendingLabel="Placing order…" disabled={slots.length === 0}>
              <SubmissionField kind="order" />
              {member && (
                <RewardChoice
                  options={rewardOptions}
                  balanceLabel={formatPoints(member.pointsBalance)}
                  earnLabel={earn > 0 ? `This order earns about ${formatPoints(earn)} once it's paid (fewer if you use a reward).` : null}
                />
              )}
              {ctx.rewards.active && !member && (
                <p className="mb-4 border-l-4 border-gold bg-paper p-3 text-sm">
                  <strong>{ctx.rewards.config.programName}:</strong> <Link href="/account?next=/checkout">sign in</Link> or{" "}
                  <Link href="/account/join?next=/checkout">join free</Link> to earn points on this order.
                </p>
              )}
              <ContactFields prefix="checkout" defaults={member ? { name: member.name, email: member.email, phone: member.phone } : undefined} />
              <fieldset className="mb-4">
                <legend className="mb-3 font-display text-xl text-gold-text">Pickup</legend>
                <p className="mb-3 text-sm">
                  At {store.street}, {store.locality}. Local delivery is through DoorDash.
                </p>
                <PickupSelect slots={slots} id="checkout-pickup" />
                <NotesField id="checkout-notes" />
                {store.allergyNotice && (
                  <p className="mt-3 border-l-4 border-gold bg-paper p-3 text-sm">
                    <strong>Allergies and dietary needs.</strong> {store.allergyNotice} If you add a note above, our team reads your order before it is prepared.
                  </p>
                )}
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

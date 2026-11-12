/**
 * Confirms "unknown" payments from the provider's own record (D42, D54). Read only on the provider's
 * side: it looks the saved Clover order up and, when Clover says it is paid, marks the record paid
 * exactly as staff would by hand. From there the usual hooks run (`advanceWhenPaid`, emails, rewards)
 * and the release-expired-holds job's `reconcilePaidHeld` takes the stock or flags it for staff.
 *
 * It never marks anything failed and never charges: a Clover order that is not paid is left
 * "unknown" for staff, because the customer may still be mid-way through a card check.
 */
import type { Payload } from "payload";

import type { Order, Reservation } from "@/payload-types";

import type { PaymentProvider } from "./types";

export type ReconcileTally = { checked: number; paid: number; stillUnknown: number };

export async function reconcileUnknownPayments(payload: Payload, provider: PaymentProvider | null): Promise<ReconcileTally> {
  const tally: ReconcileTally = { checked: 0, paid: 0, stillUnknown: 0 };
  if (!provider?.lookup) return tally;
  for (const collection of ["orders", "reservations"] as const) {
    const { docs } = await payload.find({
      collection,
      where: { and: [{ paymentStatus: { equals: "unknown" } }, { "payment.provider": { equals: provider.id } }, { "payment.providerOrderId": { exists: true } }] },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    });
    for (const doc of docs as (Order | Reservation)[]) {
      const providerOrderId = doc.payment?.providerOrderId;
      if (!providerOrderId) continue;
      tally.checked++;
      const expected = collection === "orders" ? (doc as Order).totals.totalCents : (doc as Reservation).depositCents;
      const found = await provider.lookup(providerOrderId, expected);
      if (found.status !== "paid") {
        tally.stillUnknown++;
        continue;
      }
      const payment = { ...doc.payment, provider: provider.id, reference: found.reference, providerOrderId };
      if (collection === "orders") {
        await payload.update({ collection, id: doc.id, data: { paymentStatus: "paid", payment, stockNote: "Payment confirmed from Clover by the reconcile job." }, overrideAccess: true });
      } else {
        const r = doc as Reservation;
        const full = r.depositCents >= r.totalCents;
        await payload.update({
          collection,
          id: doc.id,
          data: {
            paymentStatus: full ? "paid_in_full" : "deposit_paid",
            amountPaidCents: r.depositCents,
            balanceDueCents: r.totalCents - r.depositCents,
            payment,
            stockNote: "Payment confirmed from Clover by the reconcile job.",
          },
          overrideAccess: true,
        });
      }
      tally.paid++;
    }
  }
  return tally;
}

import type { CollectionBeforeChangeHook } from "payload";

const PAID = { orders: ["paid"], reservations: ["deposit_paid", "paid_in_full"] } as const;

/**
 * A record waits as "awaiting payment" until it is paid (A14, D42). Checkout moves it itself; this
 * hook does the same when staff reconcile a payment by hand (for example an "unknown" result they
 * confirmed with the provider), so a paid record never stays stuck in the waiting state. Notes or
 * requests from the customer send it to staff review first (A12). An explicit status in the same
 * update wins, and a record that was already moved on is left alone.
 */
export function advanceWhenPaid(collection: "orders" | "reservations"): CollectionBeforeChangeHook {
  const statusField = collection === "orders" ? "fulfillmentStatus" : "reservationStatus";
  return ({ data, originalDoc, operation }) => {
    if (operation !== "update") return data;
    const payment = data.paymentStatus ?? originalDoc?.paymentStatus;
    const status = data[statusField] ?? originalDoc?.[statusField];
    if (status !== "awaiting_payment" || !(PAID[collection] as readonly string[]).includes(payment)) return data;
    const customerText = collection === "orders" ? (data.notes ?? originalDoc?.notes) : ((data.basket ?? originalDoc?.basket) as { requests?: string } | undefined)?.requests;
    return { ...data, [statusField]: typeof customerText === "string" && customerText.trim() ? "staff_review" : collection === "orders" ? "preparing" : "confirmed" };
  };
}

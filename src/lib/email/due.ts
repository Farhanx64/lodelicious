/**
 * Which emails a record owes right now (D44). Pure: state in, list out. Framework-free.
 *
 * The rule: send when the payment status *is* paid (orders `paid`; reservations `deposit_paid` or
 * `paid_in_full`), never while it is pending, failed, unknown or refunded. Whether it was sent before is
 * the marker on the record; the claim that makes it "exactly once" is in `notify.ts`.
 *
 * `unknown_payment` is a staff-only warning: the customer is told nothing by email, because the checkout
 * page already told them not to pay again and nothing is confirmed.
 */
export type RecordKind = "orders" | "reservations" | "inquiries";
export type EmailKind = "customer" | "staff_new" | "staff_unknown" | "staff_attention";

/** The marker field (inside the `emails` group) that records each email as sent. */
export const MARKER: Record<EmailKind, "confirmationSentAt" | "staffNotifiedAt" | "unknownNotifiedAt" | "attentionNotifiedAt"> = {
  customer: "confirmationSentAt",
  staff_new: "staffNotifiedAt",
  staff_unknown: "unknownNotifiedAt",
  staff_attention: "attentionNotifiedAt",
};

/** The database column behind each marker (Payload names a group field `<group>_<snake_case_name>`). */
export const MARKER_COLUMN: Record<EmailKind, string> = {
  customer: "emails_confirmation_sent_at",
  staff_new: "emails_staff_notified_at",
  staff_unknown: "emails_unknown_notified_at",
  staff_attention: "emails_attention_notified_at",
};

export const TABLE: Record<RecordKind, string> = { orders: "orders", reservations: "reservations", inquiries: "inquiries" };

const PAID: Record<"orders" | "reservations", readonly string[]> = { orders: ["paid"], reservations: ["deposit_paid", "paid_in_full"] };

export type DueInput = {
  paymentStatus?: string | null;
  fulfillmentStatus?: string | null;
  reservationStatus?: string | null;
  stockStatus?: string | null;
  emails?: Partial<Record<(typeof MARKER)[EmailKind], string | null>> | null;
};

export function isPaid(collection: "orders" | "reservations", doc: Pick<DueInput, "paymentStatus">): boolean {
  return PAID[collection].includes(String(doc.paymentStatus));
}

export function dueEmails(collection: RecordKind, doc: DueInput): EmailKind[] {
  const sent = (k: EmailKind) => Boolean(doc.emails?.[MARKER[k]]);
  const due: EmailKind[] = [];
  if (collection === "inquiries") {
    if (!sent("customer")) due.push("customer");
    if (!sent("staff_new")) due.push("staff_new");
    return due;
  }
  const status = collection === "orders" ? doc.fulfillmentStatus : doc.reservationStatus;
  const canceled = status === "canceled";
  const paid = isPaid(collection, doc);
  if (paid && !canceled) {
    if (!sent("customer")) due.push("customer");
    if (!sent("staff_new")) due.push("staff_new");
  }
  if (doc.paymentStatus === "unknown" && !sent("staff_unknown")) due.push("staff_unknown");
  if (paid && doc.stockStatus === "needs_attention" && !sent("staff_attention")) due.push("staff_attention");
  return due;
}

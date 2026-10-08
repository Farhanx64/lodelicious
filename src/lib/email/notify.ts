/**
 * Sends the transactional emails a record owes, exactly once each (D44). Used by the `afterChange`
 * hook and by `scripts/send-pending-emails.ts`.
 *
 * Exactly once: before sending, one conditional UPDATE sets the marker (`emails.<name>SentAt`) only where
 * it is still empty. Whoever changes the row owns that email; a repeated save, a staff edit, a second
 * process or a retry finds the marker set and sends nothing. If the send fails, the marker is cleared
 * again so a later save or the retry script can send it. (A crash between the claim and the send loses that
 * one email; it is never sent twice.)
 *
 * Failures never reach the caller: `sendDueEmails` catches everything, logs a redacted line and returns.
 */
import type { Payload } from "payload";

import type { Inquiry, Order, Reservation, StoreSetting } from "@/payload-types";

import type { EnvLike } from "../app-env";
import { accessUrlToken } from "../checkout/order";
import { runBatch, query } from "../inventory/db";
import { TOPIC_LABELS } from "../inquiries/shared";
import { cleanAddress, senderFor } from "./config";
import { dueEmails, MARKER_COLUMN, TABLE, type EmailKind, type RecordKind } from "./due";
import { redact, sendEmail, type OutgoingEmail } from "./send";
import {
  customerInquiryReceipt,
  customerOrderConfirmation,
  customerReservationConfirmation,
  staffAttention,
  staffNewInquiry,
  staffNewOrder,
  staffNewReservation,
  type InquiryEmail,
  type OrderEmail,
  type Rendered,
  type ReservationEmail,
  type StoreInfo,
} from "./templates";

type AnyRecord = Order | Reservation | Inquiry;

export type SendReport = { sent: EmailKind[]; failed: EmailKind[] };

/** The public https address of the site: the first NEXT_PUBLIC_SITE_URL entry, without a trailing slash. */
export function siteUrl(env: EnvLike): string | null {
  const first = (env.NEXT_PUBLIC_SITE_URL ?? "").split(",")[0]?.trim().replace(/\/+$/, "") ?? "";
  return /^https?:\/\/[^\s]+$/i.test(first) ? first : null;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function storeInfo(s: StoreSetting): StoreInfo {
  return { name: s.name, street: s.street, locality: s.locality, phone: s.phone, email: s.email };
}

function orderData(o: Order, forStaff: boolean, env: EnvLike, store: StoreSetting): OrderEmail {
  const base = siteUrl(env);
  const notes = str(o.notes);
  const lines = Array.isArray(o.lines) ? (o.lines as Record<string, unknown>[]) : [];
  return {
    number: o.number,
    customerName: str(o.customer?.name),
    lines: lines.map((l) => ({ title: str(l.title), option: str(l.option) || null, quantity: num(l.quantity), unitPriceCents: num(l.unitPriceCents), lineTotalCents: num(l.lineTotalCents) })),
    subtotalCents: num(o.totals?.subtotalCents),
    taxCents: num(o.totals?.taxCents),
    totalCents: num(o.totals?.totalCents),
    taxApproved: Boolean(o.totals?.taxApproved),
    pickupLabel: str(o.pickup?.label) || `${str(o.pickup?.date)} ${str(o.pickup?.start)}`.trim(),
    notes,
    staffReview: forStaff ? o.fulfillmentStatus === "staff_review" || Boolean(notes.trim()) : Boolean(notes.trim()),
    testMode: Boolean(o.testMode),
    link: base && o.idempotencyKey ? `${base}/order/${encodeURIComponent(o.number)}?t=${encodeURIComponent(accessUrlToken("order", o.idempotencyKey))}` : null,
    adminLink: base ? `${base}/admin/collections/orders/${o.id}` : null,
    customerEmail: str(o.customer?.email),
    customerPhone: str(o.customer?.phone),
    store: storeInfo(store),
  };
}

function reservationData(r: Reservation, forStaff: boolean, env: EnvLike, store: StoreSetting): ReservationEmail {
  const base = siteUrl(env);
  const basket = (r.basket ?? {}) as { title?: string; requests?: string; components?: { name?: string; quantity?: number }[] };
  const requests = str(basket.requests);
  return {
    number: r.number,
    customerName: str(r.customer?.name),
    basketTitle: str(basket.title),
    components: (basket.components ?? []).map((c) => ({ name: str(c.name), quantity: num(c.quantity) })),
    totalCents: num(r.totalCents),
    taxCents: num(r.taxCents),
    paidCents: num(r.amountPaidCents),
    balanceDueCents: num(r.balanceDueCents),
    paidInFull: r.paymentStatus === "paid_in_full",
    pickupLabel: str(r.pickup?.label) || `${str(r.pickup?.date)} ${str(r.pickup?.start)}`.trim(),
    requests,
    staffReview: forStaff ? r.reservationStatus === "staff_review" || Boolean(requests.trim()) : Boolean(requests.trim()),
    testMode: Boolean(r.testMode),
    link: base && r.idempotencyKey ? `${base}/reservation/${encodeURIComponent(r.number)}?t=${encodeURIComponent(accessUrlToken("reservation", r.idempotencyKey))}` : null,
    adminLink: base ? `${base}/admin/collections/reservations/${r.id}` : null,
    customerEmail: str(r.customer?.email),
    customerPhone: str(r.customer?.phone),
    store: storeInfo(store),
  };
}

function inquiryData(i: Inquiry, env: EnvLike, store: StoreSetting): InquiryEmail {
  const base = siteUrl(env);
  const e = i.event;
  const parts = e ? [str(e.date), e.setupTime ? `setup ${str(e.setupTime)}` : "", e.guests ? `${e.guests} guests` : "", str(e.location)].filter(Boolean) : [];
  return {
    number: i.number,
    customerName: str(i.customer?.name),
    topicLabel: TOPIC_LABELS[i.topic] ?? str(i.topic),
    itemTitle: str(i.itemTitle) || null,
    message: str(i.message),
    eventSummary: parts.length ? parts.join(", ") : null,
    adminLink: base ? `${base}/admin/collections/inquiries/${i.id}` : null,
    customerEmail: str(i.customer?.email),
    customerPhone: str(i.customer?.phone),
    store: storeInfo(store),
  };
}

/** The staff address: the Store settings notification email, else the shop email. */
export function staffRecipient(store: Pick<StoreSetting, "notificationEmail" | "email">): string | null {
  return cleanAddress(store.notificationEmail) ?? cleanAddress(store.email);
}

function compose(collection: RecordKind, kind: EmailKind, doc: AnyRecord, env: EnvLike, store: StoreSetting): { rendered: Rendered; to: string | null; label: string } {
  const staffTo = staffRecipient(store);
  if (collection === "inquiries") {
    const i = doc as Inquiry;
    const data = inquiryData(i, env, store);
    return kind === "customer"
      ? { rendered: customerInquiryReceipt(data), to: cleanAddress(i.customer?.email), label: "customer_inquiry" }
      : { rendered: staffNewInquiry(data), to: staffTo, label: "staff_new_inquiry" };
  }
  const isOrder = collection === "orders";
  if (kind === "staff_unknown" || kind === "staff_attention") {
    const r = doc as Order | Reservation;
    return {
      rendered: staffAttention({
        kind: isOrder ? "order" : "reservation",
        number: r.number,
        reason: kind === "staff_unknown" ? "unknown_payment" : "stock_needs_attention",
        testMode: Boolean(r.testMode),
        adminLink: siteUrl(env) ? `${siteUrl(env)}/admin/collections/${collection}/${r.id}` : null,
        store: storeInfo(store),
      }),
      to: staffTo,
      label: `staff_${kind === "staff_unknown" ? "unknown_payment" : "stock_attention"}_${isOrder ? "order" : "reservation"}`,
    };
  }
  const forStaff = kind === "staff_new";
  if (isOrder) {
    const data = orderData(doc as Order, forStaff, env, store);
    return forStaff
      ? { rendered: staffNewOrder(data), to: staffTo, label: "staff_new_order" }
      : { rendered: customerOrderConfirmation(data), to: cleanAddress((doc as Order).customer?.email), label: "customer_order" };
  }
  const data = reservationData(doc as Reservation, forStaff, env, store);
  return forStaff
    ? { rendered: staffNewReservation(data), to: staffTo, label: "staff_new_reservation" }
    : { rendered: customerReservationConfirmation(data), to: cleanAddress((doc as Reservation).customer?.email), label: "customer_reservation" };
}

/** True when this caller now owns the email: the marker was empty and is now set. */
async function claim(payload: Payload, collection: RecordKind, id: number | string, kind: EmailKind, now: Date): Promise<boolean> {
  const table = TABLE[collection];
  const column = MARKER_COLUMN[kind];
  const results = await runBatch(payload, [{ sql: `UPDATE ${table} SET ${column} = :now WHERE id = :id AND ${column} IS NULL`, args: { now: now.toISOString(), id } }]);
  return results[0].rowsAffected === 1;
}

async function release(payload: Payload, collection: RecordKind, id: number | string, kind: EmailKind): Promise<void> {
  await query(payload, `UPDATE ${TABLE[collection]} SET ${MARKER_COLUMN[kind]} = NULL WHERE id = :id`, { id });
}

/**
 * Send whatever this record owes. Safe to call at any time and as often as you like; never throws.
 * `doc` should be the record as saved (the hook passes it; the retry script reads it).
 */
export async function sendDueEmails(payload: Payload, collection: RecordKind, doc: AnyRecord, opts: { env?: EnvLike; now?: Date } = {}): Promise<SendReport> {
  const report: SendReport = { sent: [], failed: [] };
  try {
    const env = opts.env ?? process.env;
    const due = dueEmails(collection, doc);
    if (!due.length) return report;
    const store = (await payload.findGlobal({ slug: "store-settings", depth: 0, overrideAccess: true })) as StoreSetting;
    const { from, replyTo } = senderFor(env, store);
    for (const kind of due) {
      let claimed = false;
      try {
        if (!(await claim(payload, collection, doc.id, kind, opts.now ?? new Date()))) continue;
        claimed = true;
        const { rendered, to, label } = compose(collection, kind, doc, env, store);
        if (!to) throw new Error("no valid recipient address");
        const mail: OutgoingEmail = { ...rendered, to, from, replyTo, label, ref: doc.number };
        const outcome = await sendEmail(payload, mail);
        if (!outcome.ok) throw new Error(outcome.error);
        report.sent.push(kind);
      } catch (e) {
        report.failed.push(kind);
        if (claimed) await release(payload, collection, doc.id, kind).catch(() => undefined);
        console.error(`[email] ${collection} ${doc.number}: ${kind} not sent; will retry: ${redact(e instanceof Error ? e.message : String(e))}`);
      }
    }
  } catch (e) {
    console.error(`[email] ${collection} ${doc.number}: could not check pending emails: ${redact(e instanceof Error ? e.message : String(e))}`);
  }
  return report;
}

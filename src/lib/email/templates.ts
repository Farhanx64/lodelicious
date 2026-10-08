/**
 * Email templates (D44). Pure functions: data in, `{ subject, text, html }` out. Framework-free.
 *
 * Each email is described once as a list of blocks and rendered twice, as plain text and as simple HTML
 * (inline styles, tables for layout, no images, no fonts, no scripts). Every customer-supplied string goes
 * through `escapeHtml` in the HTML and has its line breaks flattened in the subject, so a name like
 * `<script>` or a message with a newline cannot change the markup or the headers.
 *
 * What never goes into an email: a payment card or reference, the access token hash, `staffNotes`, the
 * stock note. The caller passes only the fields below, so there is nothing else to leak.
 */
import { formatCents } from "../money";

export type Rendered = { subject: string; text: string; html: string };

export type StoreInfo = { name: string; street?: string | null; locality?: string | null; phone?: string | null; email?: string | null };

type Block =
  | { kind: "heading"; text: string }
  | { kind: "p"; text: string }
  | { kind: "rows"; rows: [label: string, value: string][] }
  | { kind: "items"; items: { left: string; right: string }[] }
  | { kind: "link"; label: string; url: string }
  | { kind: "quote"; label: string; text: string };

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** One line, no control characters: safe in a subject header and in plain text. */
const oneLine = (value: unknown): string => String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
const plain = (value: unknown): string => String(value ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
const money = (cents: unknown): string => (typeof cents === "number" && Number.isSafeInteger(cents) ? formatCents(cents) : "—");
const withBreaks = (value: string): string => escapeHtml(value).replace(/\n/g, "<br>");

/** Only http(s) links are ever rendered as links. */
function safeUrl(url: string): string | null {
  return /^https?:\/\/[^\s"'<>]+$/i.test(url) ? url : null;
}

function renderText(blocks: Block[], footer: string[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.kind === "heading") out.push(plain(b.text).toUpperCase());
    else if (b.kind === "p") out.push(plain(b.text));
    else if (b.kind === "rows") out.push(b.rows.map(([l, v]) => `${l}: ${plain(v)}`).join("\n"));
    else if (b.kind === "items") out.push(b.items.map((i) => `${plain(i.left)}  ${plain(i.right)}`.trimEnd()).join("\n"));
    else if (b.kind === "link") out.push(`${b.label}\n${b.url}`);
    else out.push(`${b.label}\n  ${plain(b.text).replace(/\n/g, "\n  ")}`);
  }
  return [...out, "--", ...footer].join("\n\n") + "\n";
}

const INK = "#2b2024";
const MUTED = "#5f5257";
const RULE = "#e6dcd0";

function renderHtml(title: string, blocks: Block[], footer: string[]): string {
  const body = blocks
    .map((b) => {
      if (b.kind === "heading") return `<h2 style="margin:24px 0 8px;font-size:18px;line-height:1.3;color:${INK};">${escapeHtml(plain(b.text))}</h2>`;
      if (b.kind === "p") return `<p style="margin:0 0 12px;">${withBreaks(plain(b.text))}</p>`;
      if (b.kind === "rows")
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0 0 12px;">${b.rows
          .map(([l, v]) => `<tr><td style="padding:4px 12px 4px 0;color:${MUTED};vertical-align:top;white-space:nowrap;">${escapeHtml(l)}</td><td style="padding:4px 0;vertical-align:top;">${withBreaks(plain(v))}</td></tr>`)
          .join("")}</table>`;
      if (b.kind === "items")
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0 0 12px;">${b.items
          .map((i) => `<tr><td style="padding:6px 12px 6px 0;border-bottom:1px solid ${RULE};vertical-align:top;">${withBreaks(plain(i.left))}</td><td style="padding:6px 0;border-bottom:1px solid ${RULE};text-align:right;white-space:nowrap;vertical-align:top;">${escapeHtml(plain(i.right))}</td></tr>`)
          .join("")}</table>`;
      if (b.kind === "link") {
        const url = safeUrl(b.url);
        return url
          ? `<p style="margin:0 0 12px;"><a href="${escapeHtml(url)}" style="color:#1d4f7a;text-decoration:underline;">${escapeHtml(b.label)}</a><br><span style="font-size:13px;color:${MUTED};word-break:break-all;">${escapeHtml(url)}</span></p>`
          : "";
      }
      return `<p style="margin:0 0 12px;"><span style="color:${MUTED};">${escapeHtml(b.label)}</span><br><span style="display:block;margin:4px 0 0;padding:0 0 0 12px;border-left:3px solid ${RULE};">${withBreaks(plain(b.text))}</span></p>`;
    })
    .join("\n");
  const foot = footer.map((f) => `<p style="margin:0 0 4px;font-size:13px;color:${MUTED};">${escapeHtml(f)}</p>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(oneLine(title))}</title></head><body style="margin:0;padding:0;background:#ffffff;"><div style="max-width:600px;margin:0 auto;padding:24px 16px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.5;color:${INK};">${body}<hr style="border:0;border-top:1px solid ${RULE};margin:24px 0 12px;">${foot}</div></body></html>`;
}

function build(subject: string, blocks: Block[], footer: string[]): Rendered {
  return { subject: oneLine(subject).slice(0, 200), text: renderText(blocks, footer), html: renderHtml(subject, blocks, footer) };
}

function storeFooter(store: StoreInfo): string[] {
  const address = [store.street, store.locality].filter(Boolean).map(oneLine).join(", ");
  return [oneLine(store.name), address, store.phone ? `Phone ${oneLine(store.phone)}` : "", store.email ? `Email ${oneLine(store.email)}` : ""].filter(Boolean);
}

const firstName = (name: string): string => oneLine(name).split(" ")[0] || "there";

// ---------------------------------------------------------------- data shapes

export type EmailLine = { title: string; option?: string | null; quantity: number; unitPriceCents: number; lineTotalCents: number };

export type OrderEmail = {
  number: string;
  customerName: string;
  lines: EmailLine[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  taxApproved: boolean;
  pickupLabel: string;
  /** The customer's own notes. A non-empty note means a person checks the order before it is packed. */
  notes: string;
  staffReview: boolean;
  testMode: boolean;
  /** The private order page. Null when the site address isn't configured. */
  link: string | null;
  /** The admin page for this record, for staff emails. */
  adminLink: string | null;
  customerEmail?: string;
  customerPhone?: string;
  store: StoreInfo;
};

export type ReservationEmail = {
  number: string;
  customerName: string;
  basketTitle: string;
  components: { name: string; quantity: number }[];
  totalCents: number;
  taxCents: number;
  paidCents: number;
  balanceDueCents: number;
  paidInFull: boolean;
  pickupLabel: string;
  requests: string;
  staffReview: boolean;
  testMode: boolean;
  link: string | null;
  adminLink: string | null;
  customerEmail?: string;
  customerPhone?: string;
  store: StoreInfo;
};

export type InquiryEmail = {
  number: string;
  customerName: string;
  topicLabel: string;
  itemTitle: string | null;
  message: string;
  eventSummary: string | null;
  adminLink: string | null;
  customerEmail?: string;
  customerPhone?: string;
  store: StoreInfo;
};

const testPrefix = (test: boolean): string => (test ? "[TEST] " : "");
const testNote = (test: boolean): Block[] => (test ? [{ kind: "p", text: "This was a test order. No money moved, and nothing will be prepared." }] : []);

function lineBlock(l: EmailLine): { left: string; right: string } {
  const label = `${l.quantity} × ${oneLine(l.title)}${l.option ? ` (${oneLine(l.option)})` : ""}`;
  return { left: label, right: money(l.lineTotalCents) };
}

// ---------------------------------------------------------------- customer emails

export function customerOrderConfirmation(d: OrderEmail): Rendered {
  const blocks: Block[] = [
    { kind: "p", text: `Hi ${firstName(d.customerName)},` },
    {
      kind: "p",
      text: d.staffReview
        ? `Thank you. We have your payment for order ${d.number}. Because you left a note, a person at the shop will read it before your order is packed, and we will contact you if anything needs to change.`
        : `Thank you for your order. We have your payment, and order ${d.number} is being prepared.`,
    },
    ...testNote(d.testMode),
    { kind: "rows", rows: [["Order", d.number], ["Pickup", d.pickupLabel]] },
    { kind: "heading", text: "What you ordered" },
    { kind: "items", items: d.lines.map(lineBlock) },
    {
      kind: "rows",
      rows: [
        ["Subtotal", money(d.subtotalCents)],
        ["Tax", money(d.taxCents)],
        ["Total paid", money(d.totalCents)],
      ],
    },
  ];
  if (d.notes.trim()) blocks.push({ kind: "quote", label: "Your note", text: d.notes });
  blocks.push({ kind: "heading", text: "Pick up at" }, { kind: "p", text: storeFooter(d.store).join("\n") });
  if (d.link) blocks.push({ kind: "p", text: "You can see your order at any time here. Keep this link private; anyone who has it can see the order." }, { kind: "link", label: "View your order", url: d.link });
  blocks.push({ kind: "p", text: "Questions? Just reply to this email or call us." });
  return build(`${testPrefix(d.testMode)}Your order ${d.number}${d.staffReview ? ": we are checking your note" : " is confirmed"}`, blocks, storeFooter(d.store));
}

export function customerReservationConfirmation(d: ReservationEmail): Rendered {
  const blocks: Block[] = [
    { kind: "p", text: `Hi ${firstName(d.customerName)},` },
    {
      kind: "p",
      text: d.staffReview
        ? `Thank you. We have your ${d.paidInFull ? "payment" : "deposit"} for basket reservation ${d.number}. Because you included requests, a person at the shop will read them before the basket is made, and we will contact you if anything needs to change.`
        : `Thank you. We have your ${d.paidInFull ? "payment" : "deposit"}, and basket reservation ${d.number} is confirmed.`,
    },
    ...testNote(d.testMode),
    { kind: "rows", rows: [["Reservation", d.number], ["Pickup", d.pickupLabel]] },
    { kind: "heading", text: oneLine(d.basketTitle) || "Your basket" },
    { kind: "items", items: d.components.map((c) => ({ left: `${c.quantity} × ${oneLine(c.name)}`, right: "" })) },
    {
      kind: "rows",
      rows: [
        ["Basket total (with tax)", money(d.totalCents)],
        ["Tax included", money(d.taxCents)],
        [d.paidInFull ? "Paid in full" : "Deposit paid", money(d.paidCents)],
        ["Balance due at pickup", money(d.balanceDueCents)],
      ],
    },
  ];
  if (d.requests.trim()) blocks.push({ kind: "quote", label: "Your requests", text: d.requests });
  blocks.push({ kind: "heading", text: "Pick up at" }, { kind: "p", text: storeFooter(d.store).join("\n") });
  if (d.link) blocks.push({ kind: "p", text: "You can see your reservation at any time here. Keep this link private; anyone who has it can see it." }, { kind: "link", label: "View your reservation", url: d.link });
  blocks.push({ kind: "p", text: "Questions? Just reply to this email or call us." });
  return build(`${testPrefix(d.testMode)}Your basket reservation ${d.number}${d.staffReview ? ": we are checking your requests" : " is confirmed"}`, blocks, storeFooter(d.store));
}

export function customerInquiryReceipt(d: InquiryEmail): Rendered {
  const blocks: Block[] = [
    { kind: "p", text: `Hi ${firstName(d.customerName)},` },
    { kind: "p", text: `Thank you for getting in touch. We received your message (reference ${d.number}), and we will reply to you by email or phone.` },
    { kind: "p", text: "Nothing has been booked, reserved or charged. We will confirm details and any price with you first." },
    { kind: "rows", rows: [["Reference", d.number], ["About", d.itemTitle ? `${d.topicLabel}: ${d.itemTitle}` : d.topicLabel], ...(d.eventSummary ? ([["Event", d.eventSummary]] as [string, string][]) : [])] },
    { kind: "quote", label: "Your message", text: d.message },
    { kind: "p", text: "You can reply to this email if you want to add anything." },
  ];
  return build(`We received your message (${d.number})`, blocks, storeFooter(d.store));
}

// ---------------------------------------------------------------- staff emails

function contactRows(d: { customerName: string; customerEmail?: string; customerPhone?: string }): [string, string][] {
  return [["Customer", d.customerName], ...(d.customerEmail ? ([["Email", d.customerEmail]] as [string, string][]) : []), ...(d.customerPhone ? ([["Phone", d.customerPhone]] as [string, string][]) : [])];
}

const adminBlock = (url: string | null): Block[] => (url ? [{ kind: "link", label: "Open in the admin", url }] : []);

export function staffNewOrder(d: OrderEmail): Rendered {
  const blocks: Block[] = [
    { kind: "p", text: d.staffReview ? `New PAID order ${d.number} needs STAFF REVIEW: the customer left a note. Read it before packing.` : `New paid order ${d.number}. It is ready to prepare.` },
    ...testNote(d.testMode),
    { kind: "rows", rows: [...contactRows(d), ["Pickup", d.pickupLabel], ["Total paid", money(d.totalCents)], ["Tax", money(d.taxCents) + (d.taxApproved ? "" : " (estimate: tax class not approved)")]] },
    { kind: "items", items: d.lines.map(lineBlock) },
  ];
  if (d.notes.trim()) blocks.push({ kind: "quote", label: "Customer note", text: d.notes });
  blocks.push(...adminBlock(d.adminLink));
  return build(`${testPrefix(d.testMode)}New order ${d.number}${d.staffReview ? " (needs staff review)" : ""}: ${money(d.totalCents)}, pickup ${oneLine(d.pickupLabel)}`, blocks, [oneLine(d.store.name)]);
}

export function staffNewReservation(d: ReservationEmail): Rendered {
  const blocks: Block[] = [
    { kind: "p", text: d.staffReview ? `New basket reservation ${d.number} needs STAFF REVIEW: the customer added requests. Read them before making the basket.` : `New basket reservation ${d.number}, ${d.paidInFull ? "paid in full" : "deposit paid"}.` },
    ...testNote(d.testMode),
    { kind: "rows", rows: [...contactRows(d), ["Pickup", d.pickupLabel], ["Basket total", money(d.totalCents)], [d.paidInFull ? "Paid" : "Deposit paid", money(d.paidCents)], ["Balance due at pickup", money(d.balanceDueCents)]] },
    { kind: "heading", text: oneLine(d.basketTitle) || "Basket" },
    { kind: "items", items: d.components.map((c) => ({ left: `${c.quantity} × ${oneLine(c.name)}`, right: "" })) },
  ];
  if (d.requests.trim()) blocks.push({ kind: "quote", label: "Customer requests", text: d.requests });
  blocks.push(...adminBlock(d.adminLink));
  return build(`${testPrefix(d.testMode)}New reservation ${d.number}${d.staffReview ? " (needs staff review)" : ""}: ${money(d.paidCents)} paid, pickup ${oneLine(d.pickupLabel)}`, blocks, [oneLine(d.store.name)]);
}

export function staffNewInquiry(d: InquiryEmail): Rendered {
  const blocks: Block[] = [
    { kind: "p", text: `New inquiry ${d.number}. Nothing is booked or charged; reply to the customer.` },
    { kind: "rows", rows: [...contactRows(d), ["About", d.itemTitle ? `${d.topicLabel}: ${d.itemTitle}` : d.topicLabel], ...(d.eventSummary ? ([["Event", d.eventSummary]] as [string, string][]) : [])] },
    { kind: "quote", label: "Message", text: d.message },
    ...adminBlock(d.adminLink),
  ];
  return build(`New inquiry ${d.number}: ${d.topicLabel}`, blocks, [oneLine(d.store.name)]);
}

export type AttentionReason = "unknown_payment" | "stock_needs_attention";

export function staffAttention(d: { kind: "order" | "reservation"; number: string; reason: AttentionReason; testMode: boolean; adminLink: string | null; store: StoreInfo }): Rendered {
  const what = d.kind === "order" ? "order" : "reservation";
  const text =
    d.reason === "unknown_payment"
      ? `The payment for ${what} ${d.number} has an UNKNOWN result: it may or may not have been charged. Do not pack it. Check with the payment provider, then mark the payment paid or failed in the admin. The customer has not been emailed.`
      : `${what[0].toUpperCase()}${what.slice(1)} ${d.number} is paid, but its stock could not be taken. Check the shelf and the stock counts, fix them, then mark the stock as resolved in the admin.`;
  const blocks: Block[] = [{ kind: "p", text }, ...testNote(d.testMode), ...adminBlock(d.adminLink)];
  return build(`${testPrefix(d.testMode)}Needs attention: ${what} ${d.number} (${d.reason === "unknown_payment" ? "payment unknown" : "stock"})`, blocks, [oneLine(d.store.name)]);
}

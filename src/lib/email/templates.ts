/**
 * Email templates (D44). Pure functions: data in, `{ subject, text, html }` out. Framework-free.
 *
 * Each email is described once as a list of blocks and rendered twice, as plain text and as HTML in the
 * shop's look (2026-11-24): cream page, white card in a gold frame, the round Lodelicious logo, serif
 * headings, rose pill buttons. Inline styles and tables only (email clients drop stylesheets), no
 * scripts; the one image is the logo, with the shop's name as text when images are blocked. Every customer-supplied string goes
 * through `escapeHtml` in the HTML and has its line breaks flattened in the subject, so a name like
 * `<script>` or a message with a newline cannot change the markup or the headers.
 *
 * What never goes into an email: a payment card or reference, the access token hash, `staffNotes`, the
 * stock note. The caller passes only the fields below, so there is nothing else to leak.
 */
import { brandColor, buttonColor } from "../brand-color";
import { formatCents } from "../money";

export type Rendered = { subject: string; text: string; html: string };

export type StoreInfo = {
  name: string;
  street?: string | null;
  locality?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Opening hours from Store details (D64: shown in the ready-for-pickup email). */
  hoursLabel?: string | null;
  hours?: { days: string; time: string }[] | null;
  /** The site's https origin, for the logo and the link on it. Without it the header is the name in text. */
  siteUrl?: string | null;
  /** Store details → Brand colour and Button colour (D49); emails follow them like the website. */
  brandColor?: string | null;
  buttonColor?: string | null;
};

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

// The storefront's palette (app/globals.css).
const INK = "#3b2f25";
const MUTED = "#665a4e";
const GOLD_TEXT = "#735a39";
const CREAM = "#f7f2ee";
const RULE = "#e3d8cc";
const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
const SANS = "'Source Sans 3','Helvetica Neue',Helvetica,Arial,sans-serif";

/** `hex` mixed with white: `amount` 0 is white, 1 is the colour. Inputs are validated #rrggbb. */
function tint(hex: string, amount: number): string {
  const mix = (i: number) => Math.round(255 - (255 - parseInt(hex.slice(i, i + 2), 16)) * amount).toString(16).padStart(2, "0");
  return `#${mix(1)}${mix(3)}${mix(5)}`;
}

/** "Total paid", "Balance due at pickup": the row the customer looks for, set apart in bold. */
const isTotal = (label: string) => /^(total|balance due)/i.test(label);

function renderHtml(title: string, blocks: Block[], footer: string[], store?: StoreInfo): string {
  // Only validated #rrggbb colours reach the markup (brandColor/buttonColor fall back to the defaults).
  const ROSE = brandColor(store?.brandColor);
  const BLUSH = tint(ROSE, 0.12);
  const GOLD = buttonColor(store?.buttonColor);
  const body = blocks
    .map((b) => {
      if (b.kind === "heading")
        return `<h2 style="margin:28px 0 10px;padding:0 0 8px;border-bottom:1px solid ${GOLD};font-family:${SERIF};font-size:20px;font-weight:600;line-height:1.3;letter-spacing:2px;text-transform:uppercase;color:${GOLD_TEXT};">${escapeHtml(plain(b.text))}</h2>`;
      if (b.kind === "p") return `<p style="margin:0 0 14px;">${withBreaks(plain(b.text))}</p>`;
      if (b.kind === "rows")
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0 0 14px;">${b.rows
          .map(([l, v]) => {
            const total = isTotal(l);
            const cell = total ? `border-top:1px solid ${GOLD};padding-top:10px;font-weight:700;color:${INK};` : "";
            return `<tr><td style="padding:5px 12px 5px 0;color:${MUTED};vertical-align:top;${cell}">${escapeHtml(l)}</td><td style="padding:5px 0;vertical-align:top;text-align:right;${cell}">${withBreaks(plain(v))}</td></tr>`;
          })
          .join("")}</table>`;
      if (b.kind === "items")
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0 0 14px;">${b.items
          .map((i) => `<tr><td style="padding:9px 12px 9px 0;border-bottom:1px solid ${RULE};vertical-align:top;">${withBreaks(plain(i.left))}</td><td style="padding:9px 0;border-bottom:1px solid ${RULE};text-align:right;white-space:nowrap;vertical-align:top;">${escapeHtml(plain(i.right))}</td></tr>`)
          .join("")}</table>`;
      if (b.kind === "link") {
        const url = safeUrl(b.url);
        return url
          ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 8px;"><tr><td style="border-radius:999px;background:${ROSE};"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 28px;font-family:${SANS};font-size:15px;font-weight:600;letter-spacing:1px;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(b.label)}</a></td></tr></table><p style="margin:0 0 14px;font-size:12px;color:${MUTED};word-break:break-all;">${escapeHtml(url)}</p>`
          : "";
      }
      return `<p style="margin:0 0 14px;"><span style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${GOLD_TEXT};">${escapeHtml(b.label)}</span><span style="display:block;margin:6px 0 0;padding:10px 14px;background:${BLUSH};border-left:3px solid ${ROSE};">${withBreaks(plain(b.text))}</span></p>`;
    })
    .join("\n");

  const site = store?.siteUrl && safeUrl(store.siteUrl) ? store.siteUrl.replace(/\/+$/, "") : null;
  const name = escapeHtml(oneLine(store?.name || "Lodelicious"));
  const wordmark = `<div style="font-family:${SERIF};font-size:30px;letter-spacing:6px;text-transform:uppercase;color:${GOLD_TEXT};">${name}</div>`;
  const logo = site
    ? `<a href="${escapeHtml(site)}" style="text-decoration:none;"><img src="${escapeHtml(site)}/brand/logo-email.png" width="120" height="120" alt="${name} Gifts &amp; Sweets" style="display:block;margin:0 auto;width:120px;height:120px;border:0;font-family:${SERIF};font-size:24px;color:${GOLD_TEXT};"></a>`
    : wordmark;
  const tagline = `<div style="margin-top:10px;font-family:${SANS};font-size:11px;letter-spacing:4px;text-transform:uppercase;color:${GOLD_TEXT};">Sweets &middot; Chocolates &middot; Gifts</div>`;
  const heading = `<h1 style="margin:0 0 20px;font-family:${SERIF};font-size:28px;font-weight:600;line-height:1.25;color:${INK};text-align:center;">${escapeHtml(oneLine(title))}</h1>`;
  const foot = footer
    .map((f, i) => `<p style="margin:0 0 4px;font-size:13px;color:${MUTED};${i === 0 ? `font-family:${SERIF};font-size:16px;letter-spacing:2px;text-transform:uppercase;color:${GOLD_TEXT};` : ""}">${escapeHtml(f)}</p>`)
    .join("");
  const preheader = `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${CREAM};">${escapeHtml(oneLine(title))}</div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(oneLine(title))}</title><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&amp;family=Source+Sans+3:wght@400;600&amp;display=swap" rel="stylesheet"></head><body style="margin:0;padding:0;background:${CREAM};">${preheader}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${CREAM};"><tr><td align="center" style="padding:0;"><div style="height:6px;background:${ROSE};line-height:6px;font-size:0;">&nbsp;</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:600px;"><tr><td align="center" style="padding:28px 16px 22px;">${logo}${tagline}</td></tr><tr><td style="padding:0 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:#ffffff;border:1px solid ${GOLD};"><tr><td style="padding:4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${RULE};"><tr><td style="padding:28px 24px 20px;font-family:${SANS};font-size:16px;line-height:1.55;color:${INK};">${heading}${body}</td></tr></table></td></tr></table></td></tr><tr><td align="center" style="padding:24px 16px 32px;font-family:${SANS};text-align:center;">${foot}<p style="margin:12px 0 0;font-size:12px;color:${MUTED};">Made by hand at our shop &middot; ${site ? `<a href="${escapeHtml(site)}" style="color:${ROSE};text-decoration:underline;">${escapeHtml(site.replace(/^https?:\/\//, ""))}</a>` : name}</p></td></tr></table></td></tr></table></body></html>`;
}

function build(subject: string, blocks: Block[], footer: string[], store?: StoreInfo): Rendered {
  return { subject: oneLine(subject).slice(0, 200), text: renderText(blocks, footer), html: renderHtml(subject, blocks, footer, store) };
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
  /** A rewards discount taken off before tax (D47); 0 for none. */
  discountCents?: number;
  /** Points the member earns once paid (D47); 0 or missing for none. */
  earnPoints?: number;
  taxCents: number;
  totalCents: number;
  taxApproved: boolean;
  /** How the tax was worked out (D65): "Tax (MA 6.25%)" or "No sales tax (ships to NY)". Missing on older orders. */
  taxLabel?: string | null;
  pickupLabel: string;
  /** Set when the order ships (D54): the address, on one line. Pickup rows are then replaced by it. */
  shipTo?: string | null;
  shippingCents?: number;
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
  /** As on orders (D65). */
  taxLabel?: string | null;
  paidCents: number;
  balanceDueCents: number;
  paidInFull: boolean;
  pickupLabel: string;
  /** Set when the basket ships (D54). */
  shipTo?: string | null;
  shippingCents?: number;
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

/** "Pickup: …" or "Ship to: …" (D54). */
const whereRow = (d: { pickupLabel: string; shipTo?: string | null }): [string, string] => (d.shipTo ? ["Ship to", d.shipTo] : ["Pickup", d.pickupLabel]);
const whereSubject = (d: { pickupLabel: string; shipTo?: string | null }): string => (d.shipTo ? "shipping" : `pickup ${oneLine(d.pickupLabel)}`);
const shippingRows = (d: { shippingCents?: number; shipTo?: string | null }): [string, string][] => (d.shipTo ? [["Shipping", money(d.shippingCents ?? 0)]] : []);

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
    { kind: "rows", rows: [["Order", d.number], whereRow(d)] },
    { kind: "heading", text: "What you ordered" },
    { kind: "items", items: d.lines.map(lineBlock) },
    {
      kind: "rows",
      rows: [
        ["Subtotal", money(d.subtotalCents)],
        ...(d.discountCents ? ([["Reward", `-${money(d.discountCents)}`]] as [string, string][]) : []),
        [oneLine(d.taxLabel || "Tax"), money(d.taxCents)],
        ...shippingRows(d),
        ["Total paid", money(d.totalCents)],
        ...(d.earnPoints ? ([["Points earned", d.earnPoints.toLocaleString("en-US")]] as [string, string][]) : []),
      ],
    },
  ];
  if (d.notes.trim()) blocks.push({ kind: "quote", label: "Your note", text: d.notes });
  blocks.push({ kind: "heading", text: d.shipTo ? "Our shop" : "Pick up at" }, { kind: "p", text: storeFooter(d.store).join("\n") });
  if (d.link) blocks.push({ kind: "p", text: "You can see your order at any time here. Keep this link private; anyone who has it can see the order." }, { kind: "link", label: "View your order", url: d.link });
  blocks.push({ kind: "p", text: "Questions? Just reply to this email or call us." });
  return build(`${testPrefix(d.testMode)}Your order ${d.number}${d.staffReview ? ": we are checking your note" : " is confirmed"}`, blocks, storeFooter(d.store), d.store);
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
    { kind: "rows", rows: [["Reservation", d.number], whereRow(d)] },
    { kind: "heading", text: oneLine(d.basketTitle) || "Your basket" },
    { kind: "items", items: d.components.map((c) => ({ left: `${c.quantity} × ${oneLine(c.name)}`, right: "" })) },
    {
      kind: "rows",
      rows: [
        [d.shipTo ? "Total (with tax and shipping)" : "Basket total (with tax)", money(d.totalCents)],
        [d.taxLabel && d.taxLabel !== "Tax" ? `${oneLine(d.taxLabel)}, included` : "Tax included", money(d.taxCents)],
        ...shippingRows(d),
        [d.paidInFull ? "Paid in full" : "Deposit paid", money(d.paidCents)],
        ["Balance due at pickup", money(d.balanceDueCents)],
      ],
    },
  ];
  if (d.requests.trim()) blocks.push({ kind: "quote", label: "Your requests", text: d.requests });
  blocks.push({ kind: "heading", text: d.shipTo ? "Our shop" : "Pick up at" }, { kind: "p", text: storeFooter(d.store).join("\n") });
  if (d.link) blocks.push({ kind: "p", text: "You can see your reservation at any time here. Keep this link private; anyone who has it can see it." }, { kind: "link", label: "View your reservation", url: d.link });
  blocks.push({ kind: "p", text: "Questions? Just reply to this email or call us." });
  return build(`${testPrefix(d.testMode)}Your basket reservation ${d.number}${d.staffReview ? ": we are checking your requests" : " is confirmed"}`, blocks, storeFooter(d.store), d.store);
}

/**
 * The "we got your message" receipt goes to whatever address was typed into a public form, so it
 * carries nothing the sender wrote: no name, message or event details (security audit 2026-11-26).
 * Otherwise anyone could use the shop's address to send their own text to a stranger. The staff
 * notification still has everything.
 */
export function customerInquiryReceipt(d: InquiryEmail): Rendered {
  const blocks: Block[] = [
    { kind: "p", text: "Hello," },
    { kind: "p", text: `Thank you for getting in touch. We received your message (reference ${d.number}), and we will reply to you by email or phone.` },
    { kind: "p", text: "Nothing has been booked, reserved or charged. We will confirm details and any price with you first." },
    { kind: "rows", rows: [["Reference", d.number], ["About", d.itemTitle ? `${d.topicLabel}: ${d.itemTitle}` : d.topicLabel]] },
    { kind: "p", text: "You can reply to this email if you want to add anything. If you didn't send us a message, you can ignore this email." },
  ];
  return build(`We received your message (${d.number})`, blocks, storeFooter(d.store), d.store);
}

// ---------------------------------------------------------------- status emails (D64)

/** The shop's address, phone and opening hours, for a customer on their way to pick up. */
function pickupAtBlocks(store: StoreInfo): Block[] {
  const address = [store.street, store.locality].filter(Boolean).map(oneLine).join(", ");
  const blocks: Block[] = [{ kind: "heading", text: "Pick up at" }, { kind: "p", text: [oneLine(store.name), address, store.phone ? `Phone ${oneLine(store.phone)}` : ""].filter(Boolean).join("\n") }];
  const hours = (store.hours ?? []).filter((h) => oneLine(h.days) && oneLine(h.time));
  if (hours.length) {
    blocks.push({ kind: "heading", text: oneLine(store.hoursLabel) || "Opening hours" }, { kind: "rows", rows: hours.map((h) => [oneLine(h.days), oneLine(h.time)] as [string, string]) });
  }
  return blocks;
}

export type ReadyEmail =
  | ({ kind: "order" } & Pick<OrderEmail, "number" | "customerName" | "lines" | "pickupLabel" | "notes" | "testMode" | "link" | "store">)
  | ({ kind: "reservation" } & Pick<ReservationEmail, "number" | "customerName" | "basketTitle" | "components" | "balanceDueCents" | "pickupLabel" | "testMode" | "link" | "store">);

export function customerReadyForPickup(d: ReadyEmail): Rendered {
  const isOrder = d.kind === "order";
  const what = isOrder ? `order ${d.number}` : `basket reservation ${d.number}`;
  const blocks: Block[] = [
    { kind: "p", text: `Hi ${firstName(d.customerName)},` },
    { kind: "p", text: `Good news: your ${what} is ready for pickup.` },
    ...testNote(d.testMode),
    { kind: "rows", rows: [[isOrder ? "Order" : "Reservation", d.number], ["Pickup", d.pickupLabel], ...(!isOrder && d.balanceDueCents > 0 ? ([["Balance due at pickup", money(d.balanceDueCents)]] as [string, string][]) : [])] },
  ];
  if (isOrder) blocks.push({ kind: "heading", text: "What you ordered" }, { kind: "items", items: d.lines.map(lineBlock) });
  else blocks.push({ kind: "heading", text: oneLine(d.basketTitle) || "Your basket" }, { kind: "items", items: d.components.map((c) => ({ left: `${c.quantity} × ${oneLine(c.name)}`, right: "" })) });
  blocks.push(...pickupAtBlocks(d.store));
  blocks.push({ kind: "p", text: `Please bring your ${isOrder ? "order" : "reservation"} number. If you can't come at your pickup time, reply to this email or call us.` });
  if (d.link) blocks.push({ kind: "link", label: isOrder ? "View your order" : "View your reservation", url: d.link });
  return build(`${testPrefix(d.testMode)}Your ${isOrder ? "order" : "basket reservation"} ${d.number} is ready for pickup`, blocks, storeFooter(d.store), d.store);
}

export type ShippedEmail = Pick<OrderEmail, "number" | "customerName" | "lines" | "shipTo" | "testMode" | "link" | "store"> & {
  /** "USPS", "UPS", "FedEx" or null for another carrier. */
  carrierName: string | null;
  trackingNumber: string | null;
  /** The carrier's tracking page, or null (no number, or another carrier). */
  trackingUrl: string | null;
};

export function customerShipped(d: ShippedEmail): Rendered {
  const tracking: [string, string][] = [
    ...(d.carrierName ? ([["Carrier", d.carrierName]] as [string, string][]) : []),
    ...(d.trackingNumber ? ([["Tracking number", d.trackingNumber]] as [string, string][]) : []),
  ];
  const blocks: Block[] = [
    { kind: "p", text: `Hi ${firstName(d.customerName)},` },
    { kind: "p", text: `Your order ${d.number} has shipped and is on its way to you.` },
    ...testNote(d.testMode),
    { kind: "rows", rows: [["Order", d.number], ...(d.shipTo ? ([["Ship to", d.shipTo]] as [string, string][]) : []), ...tracking] },
  ];
  if (d.trackingUrl) blocks.push({ kind: "link", label: `Track your parcel${d.carrierName ? ` with ${d.carrierName}` : ""}`, url: d.trackingUrl });
  else if (d.trackingNumber) blocks.push({ kind: "p", text: "You can track the parcel on the carrier's website with the tracking number above." });
  blocks.push({ kind: "heading", text: "What's in the parcel" }, { kind: "items", items: d.lines.map(lineBlock) });
  if (d.link) blocks.push({ kind: "link", label: "View your order", url: d.link });
  blocks.push({ kind: "p", text: "Questions? Just reply to this email or call us." });
  return build(`${testPrefix(d.testMode)}Your order ${d.number} has shipped`, blocks, storeFooter(d.store), d.store);
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
    { kind: "rows", rows: [...contactRows(d), whereRow(d), ...shippingRows(d), ["Total paid", money(d.totalCents)], [oneLine(d.taxLabel || "Tax"), money(d.taxCents) + (d.taxApproved ? "" : " (estimate: tax class not approved)")]] },
    { kind: "items", items: d.lines.map(lineBlock) },
  ];
  if (d.notes.trim()) blocks.push({ kind: "quote", label: "Customer note", text: d.notes });
  blocks.push(...adminBlock(d.adminLink));
  return build(`${testPrefix(d.testMode)}New order ${d.number}${d.staffReview ? " (needs staff review)" : ""}: ${money(d.totalCents)}, ${whereSubject(d)}`, blocks, [oneLine(d.store.name)], d.store);
}

export function staffNewReservation(d: ReservationEmail): Rendered {
  const blocks: Block[] = [
    { kind: "p", text: d.staffReview ? `New basket reservation ${d.number} needs STAFF REVIEW: the customer added requests. Read them before making the basket.` : `New basket reservation ${d.number}, ${d.paidInFull ? "paid in full" : "deposit paid"}.` },
    ...testNote(d.testMode),
    { kind: "rows", rows: [...contactRows(d), whereRow(d), ...shippingRows(d), ["Basket total", money(d.totalCents)], [d.paidInFull ? "Paid" : "Deposit paid", money(d.paidCents)], ["Balance due at pickup", money(d.balanceDueCents)]] },
    { kind: "heading", text: oneLine(d.basketTitle) || "Basket" },
    { kind: "items", items: d.components.map((c) => ({ left: `${c.quantity} × ${oneLine(c.name)}`, right: "" })) },
  ];
  if (d.requests.trim()) blocks.push({ kind: "quote", label: "Customer requests", text: d.requests });
  blocks.push(...adminBlock(d.adminLink));
  return build(`${testPrefix(d.testMode)}New reservation ${d.number}${d.staffReview ? " (needs staff review)" : ""}: ${money(d.paidCents)} paid, ${whereSubject(d)}`, blocks, [oneLine(d.store.name)], d.store);
}

export function staffNewInquiry(d: InquiryEmail): Rendered {
  const blocks: Block[] = [
    { kind: "p", text: `New inquiry ${d.number}. Nothing is booked or charged; reply to the customer.` },
    { kind: "rows", rows: [...contactRows(d), ["About", d.itemTitle ? `${d.topicLabel}: ${d.itemTitle}` : d.topicLabel], ...(d.eventSummary ? ([["Event", d.eventSummary]] as [string, string][]) : [])] },
    { kind: "quote", label: "Message", text: d.message },
    ...adminBlock(d.adminLink),
  ];
  return build(`New inquiry ${d.number}: ${d.topicLabel}`, blocks, [oneLine(d.store.name)], d.store);
}

export type AttentionReason = "unknown_payment" | "stock_needs_attention";

export function staffAttention(d: { kind: "order" | "reservation"; number: string; reason: AttentionReason; testMode: boolean; adminLink: string | null; store: StoreInfo }): Rendered {
  const what = d.kind === "order" ? "order" : "reservation";
  const text =
    d.reason === "unknown_payment"
      ? `The payment for ${what} ${d.number} has an UNKNOWN result: it may or may not have been charged. Do not pack it. Check with the payment provider, then mark the payment paid or failed in the admin. The customer has not been emailed.`
      : `${what[0].toUpperCase()}${what.slice(1)} ${d.number} is paid, but its stock could not be taken. Check the shelf and the stock counts, fix them, then mark the stock as resolved in the admin.`;
  const blocks: Block[] = [{ kind: "p", text }, ...testNote(d.testMode), ...adminBlock(d.adminLink)];
  return build(`${testPrefix(d.testMode)}Needs attention: ${what} ${d.number} (${d.reason === "unknown_payment" ? "payment unknown" : "stock"})`, blocks, [oneLine(d.store.name)], d.store);
}

// ---------------------------------------------------------------- rewards members (D47)

export type MemberResetEmail = { name: string; programName: string; link: string; minutes: number; store: StoreInfo };

export function memberPasswordReset(d: MemberResetEmail): Rendered {
  const blocks: Block[] = [
    { kind: "p", text: `Hi ${firstName(d.name)},` },
    { kind: "p", text: `Someone asked to reset the password for your ${oneLine(d.programName)} account. If it was you, choose a new password here. The link works for ${d.minutes} minutes and only once.` },
    { kind: "link", label: "Choose a new password", url: d.link },
    { kind: "p", text: "If you didn't ask for this, you can ignore this email: your password stays the same." },
  ];
  return build(`Reset your ${oneLine(d.programName)} password`, blocks, storeFooter(d.store), d.store);
}

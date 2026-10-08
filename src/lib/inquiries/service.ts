/**
 * Inquiry service (D37). Framework-free: takes the Payload instance and "now", so integration
 * tests drive the exact code the server actions run.
 *
 * An inquiry books nothing and charges nothing. It is created in the staff-review status `new`;
 * staff reply by email or phone. Only this service creates inquiries (collection access: nobody
 * can create), always with the estimate recomputed here from the stored event settings.
 */
import type { Payload } from "payload";

import type { Category, Inquiry } from "@/payload-types";

import { idempotencyKey } from "../checkout/order";
import { SHOP_TZ } from "../checkout/pickup";
import { fountainEstimate, type FountainEstimate } from "./estimate";
import { eventOfferFrom, type EventOffer } from "./offer";
import { parseContactInquiry, parseFountainInquiry, parseItemSlug, type ParsedInquiry } from "./parse";
import { echoValues, formatInquiryNumber, type InquiryFormState } from "./shared";

export type InquiryKind = "contact" | "fountain";

/** `number: null` means a bot was silently dropped (nothing was stored). Real submissions always get a number. */
export type InquiryResult = { ok: true; number: string | null } | { ok: false; error: string };

export type InquiryItem = { id: number; slug: string; title: string; categorySlug: string | null };

/** The fountain offer from the event-settings global (defaults apply until it has been saved). */
export async function loadEventOffer(payload: Payload): Promise<EventOffer> {
  return eventOfferFrom(await payload.findGlobal({ slug: "event-settings", depth: 0, overrideAccess: true }));
}

/**
 * `?item=` lookup: a published, non-hidden product (the same rule as the product page). Products
 * are staff-only over REST (A04, D42), so the rule is the explicit `where` below, read with override;
 * drafts can never be found. Malformed or unknown slugs return null and are ignored.
 */
export async function findPublishedItem(payload: Payload, rawSlug: unknown): Promise<InquiryItem | null> {
  const slug = parseItemSlug(rawSlug);
  if (!slug) return null;
  const { docs } = await payload.find({
    collection: "products",
    where: { and: [{ slug: { equals: slug } }, { _status: { equals: "published" } }, { channel: { not_equals: "hidden" } }] },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  const product = docs[0];
  if (!product?.slug) return null;
  const category = typeof product.category === "object" && product.category !== null ? (product.category as Category) : null;
  return { id: product.id, slug: product.slug, title: product.title, categorySlug: category?.slug ?? null };
}

async function findByKey(payload: Payload, key: string): Promise<Inquiry | null> {
  const { docs } = await payload.find({ collection: "inquiries", where: { idempotencyKey: { equals: key } }, limit: 1, depth: 0, overrideAccess: true });
  return docs[0] ?? null;
}

/** One above the highest sequence ever used. Counting rows would reuse a number after the owner deletes an inquiry. */
async function nextSequence(payload: Payload): Promise<number> {
  const { docs } = await payload.find({ collection: "inquiries", sort: "-sequence", limit: 1, depth: 0, overrideAccess: true });
  return (docs[0]?.sequence ?? 0) + 1;
}

/**
 * Creates the inquiry once per idempotency key. A double click or a retried submit returns the
 * first inquiry; if two different submissions race for the same number, the loser retries.
 */
async function createOnce(payload: Payload, key: string, data: Record<string, unknown>): Promise<Inquiry> {
  for (let attempt = 0; ; attempt++) {
    const existing = await findByKey(payload, key);
    if (existing) return existing;
    const sequence = await nextSequence(payload);
    try {
      return await payload.create({
        collection: "inquiries",
        data: { ...data, idempotencyKey: key, sequence, number: formatInquiryNumber(sequence) } as never,
        overrideAccess: true,
      });
    } catch (e) {
      if (attempt >= 4) throw e;
    }
  }
}

function estimateSnapshot(estimate: FountainEstimate, offer: EventOffer) {
  const { terms } = offer;
  return {
    baseCents: estimate.baseCents,
    includedHours: terms.includedHours,
    perGuestCents: estimate.perGuestCents,
    chocolatePerGuestCents: terms.chocolatePerGuestCents,
    fruitPerGuestCents: terms.fruitPerGuestCents,
    depositPercentBasisPoints: terms.depositPercentBasisPoints,
    guests: estimate.guests,
    guestsCents: estimate.guestsCents,
    totalCents: estimate.totalCents,
  };
}

export async function submitInquiry(payload: Payload, input: { kind: InquiryKind; form: Record<string, unknown>; now?: Date }): Promise<InquiryResult> {
  const now = input.now ?? new Date();
  const parsed = input.kind === "fountain" ? parseFountainInquiry(input.form, { now, timeZone: SHOP_TZ }) : parseContactInquiry(input.form);
  if (parsed.status === "bot") return { ok: true, number: null };
  if (parsed.status === "invalid") return { ok: false, error: parsed.error };
  const inquiry: ParsedInquiry = parsed.inquiry;

  let estimate: FountainEstimate | null = null;
  let offer: EventOffer | null = null;
  if (inquiry.event) {
    offer = await loadEventOffer(payload);
    if (!offer.enabled) return { ok: false, error: "Chocolate fountain rentals aren't open for online requests right now. Please contact us and we'll be glad to help." };
    // The estimate is always computed here from the stored settings; nothing the browser sent is read.
    estimate = fountainEstimate(inquiry.event.guests, offer.terms);
    if (!estimate) return { ok: false, error: "Please check the number of guests." };
  }

  const item = inquiry.itemSlug ? await findPublishedItem(payload, inquiry.itemSlug) : null;
  const key = idempotencyKey("inquiry", inquiry.topic, item?.id ?? null, inquiry.customer, inquiry.message, inquiry.event);
  const created = await createOnce(payload, key, {
    status: "new",
    topic: inquiry.topic,
    product: item?.id ?? null,
    itemTitle: item?.title ?? null,
    customer: inquiry.customer,
    message: inquiry.message,
    event: inquiry.event ? { date: inquiry.event.date, location: inquiry.event.location, guests: inquiry.event.guests, setupTime: inquiry.event.setupTime } : undefined,
    estimateCents: estimate?.totalCents ?? null,
    estimateTerms: estimate && offer ? estimateSnapshot(estimate, offer) : null,
  });
  // Emails arrive in a later milestone; until then staff see new inquiries in /admin.
  console.info(`[inquiry] ${created.number} received (${created.topic}); notification email not configured yet`);
  return { ok: true, number: created.number };
}

/**
 * What the form actions return: success, or an error with the visitor's entries echoed back.
 * Unexpected failures are logged and shown as a generic apology, never as internals.
 */
export async function inquiryFormState(payload: Payload, kind: InquiryKind, form: Record<string, unknown>, now?: Date): Promise<InquiryFormState> {
  try {
    const result = await submitInquiry(payload, { kind, form, now });
    if (result.ok) return { error: null, sent: true, number: result.number };
    return { error: result.error, values: echoValues(form) };
  } catch (e) {
    console.error("[inquiry] could not be saved", e);
    return { error: "Sorry, something went wrong on our side and your message wasn't sent. Please try again, or call us.", values: echoValues(form) };
  }
}

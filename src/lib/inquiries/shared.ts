/**
 * Constants shared by the inquiry forms, the admin collection and the parser (D37). No imports,
 * so client components, collections and server code can all use it.
 */

/** The shared contract with the other storefront pages: any page links to /contact?topic=<topic>. */
export const INQUIRY_TOPICS = [
  "general",
  "gift_basket",
  "gift_box",
  "baby_white",
  "cowboy",
  "filled_ceramic",
  "custom_request",
  "fountain",
] as const;
export type InquiryTopic = (typeof INQUIRY_TOPICS)[number];

/** Topics the general form accepts. The fountain has its own form, which computes its estimate. */
export const CONTACT_TOPICS = INQUIRY_TOPICS.filter((t) => t !== "fountain") as readonly Exclude<InquiryTopic, "fountain">[];
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const TOPIC_LABELS: Record<InquiryTopic, string> = {
  general: "A general question",
  gift_basket: "A gift basket",
  gift_box: "A seasonal gift box",
  baby_white: "The Baby White basket",
  cowboy: "The Cowboy basket",
  filled_ceramic: "A filled baby ceramic",
  custom_request: "A custom or dietary request",
  fountain: "Chocolate fountain rental",
};

export const INQUIRY_STATUSES = ["new", "in_review", "awaiting_customer", "confirmed", "declined", "closed"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const STATUS_LABELS: Record<InquiryStatus, string> = {
  new: "New",
  in_review: "In review",
  awaiting_customer: "Waiting for the customer",
  confirmed: "Confirmed",
  declined: "Declined",
  closed: "Closed",
};

/** INQ-1001, INQ-1002, … Orders use SP-, reservations SPR-. */
export const formatInquiryNumber = (sequence: number): string => `INQ-${1000 + sequence}`;

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_LOCATION_LENGTH = 300;

/**
 * Honeypot: a field real visitors never see or fill in. The name is deliberately not one that
 * browsers autofill (not "website", "company", "phone"…), so a filled value means a bot.
 */
export const HONEYPOT_FIELD = "fax_number";

export const isInquiryTopic = (value: unknown): value is InquiryTopic => typeof value === "string" && (INQUIRY_TOPICS as readonly string[]).includes(value);
export const isContactTopic = (value: unknown): value is ContactTopic => typeof value === "string" && (CONTACT_TOPICS as readonly string[]).includes(value);

/** Gift-basket products ask about a basket; everything else asks a general question. */
export function topicForProduct(categorySlug: string | null | undefined): ContactTopic {
  return categorySlug === "gift-baskets" ? "gift_basket" : "general";
}

/** The inquiry topic for a gift-builder special presentation, or null if it has none. */
export function topicForPresentation(code: string): ContactTopic | null {
  if (code === "cowboy" || code === "baby_white") return code;
  if (code === "ceramic_bowl" || code === "ceramic_shoes" || code === "ceramic_block") return "filled_ceramic";
  return null;
}

/** `/contact` link that preselects a topic and, optionally, the product being asked about. */
export function contactHref(opts: { topic?: ContactTopic; item?: string | null } = {}): string {
  const params = new URLSearchParams();
  if (opts.topic) params.set("topic", opts.topic);
  if (opts.item) params.set("item", opts.item);
  const query = params.toString();
  return query ? `/contact?${query}` : "/contact";
}

/** What a form action hands back to the form: an error, or success (with the number, unless a bot was dropped). */
export type InquiryFormState = {
  error: string | null;
  sent?: boolean;
  number?: string | null;
  /** The visitor's own entries, echoed back after an error so they don't have to type them again. */
  values?: Record<string, string>;
};

const ECHOED_FIELDS = ["topic", "message", "name", "email", "phone", "eventDate", "setupTime", "location", "guests"] as const;

/** The known form fields as short strings. The honeypot and anything unexpected are never echoed. */
export function echoValues(form: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(ECHOED_FIELDS.map((key) => [key, typeof form[key] === "string" ? (form[key] as string).slice(0, MAX_MESSAGE_LENGTH) : ""]));
}

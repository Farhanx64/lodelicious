/**
 * Customer policies (D39). Lody edits and approves the text in /admin → Policies; this file holds
 * the fixed list of policies, the built-in draft wording shown on staging, and the rule for what a
 * visitor sees. Framework-free (no Payload or Next imports) so it can be unit-tested.
 *
 * The drafts are built only from facts the PRD, the decisions log or the code confirm. Where a
 * term is unresolved (refund amounts, deadlines, cancellation windows, deposit refundability,
 * the reporting window) the draft says so plainly and sends the customer to the shop. It never
 * fills the term in, and it never reaches the live site: live shows approved text only.
 */

export const POLICY_SLUGS = [
  "pickup-and-delivery",
  "cancellations-and-refunds",
  "substitutions-and-dietary-requests",
  "damaged-or-missing-items",
  "privacy",
] as const;
export type PolicySlug = (typeof POLICY_SLUGS)[number];

/** Group names in the `policies` global (camelCase: slugs contain hyphens). */
export type PolicyField = "pickupAndDelivery" | "cancellationsAndRefunds" | "substitutionsAndDietaryRequests" | "damagedOrMissingItems" | "privacy";

/** Store-settings facts the drafts may quote, so they never drift from what the shop has set. */
export type ContactFacts = {
  street: string;
  locality: string;
  phone: string;
  email: string;
  doordashUrl?: string | null;
};

export type PolicyDefinition = {
  slug: PolicySlug;
  field: PolicyField;
  /** Default title. Staff may override it in the admin. */
  title: string;
  /** One line for the index page. */
  summary: string;
  /** Draft wording: plain text, a blank line between paragraphs. */
  draft: (contact: ContactFacts) => string;
  /** Terms the draft deliberately leaves open. Shown to Lody on staging only. */
  openTerms: readonly string[];
  /** Show the store-wide allergy notice (Store settings) under this policy. */
  showsAllergyNotice?: boolean;
};

const DOORDASH_PAGE = (c: ContactFacts) =>
  c.doordashUrl
    ? "You order delivery on the shop’s DoorDash page, not through this website’s checkout."
    : "The shop’s DoorDash page is not published on this website yet. Please contact us if you would like to ask about delivery.";

export const POLICIES: readonly PolicyDefinition[] = [
  {
    slug: "pickup-and-delivery",
    field: "pickupAndDelivery",
    title: "Pickup and delivery",
    summary: "Free pickup in Plymouth, preparation time, and local delivery through DoorDash.",
    draft: (c) =>
      [
        `Pickup is free at ${c.street}, ${c.locality}. Choose a pickup time at checkout from the times the shop has available. Those times follow the shop’s hours and the notice the shop currently asks for.`,
        "Preparation takes about an hour, depending on how busy the shop is. We cannot promise that an order will be ready within an hour. Custom baskets are made to order and need advance notice, which is shown when you reserve. For large, holiday and special orders, please contact us ahead of time so we can confirm the timing.",
        `Local delivery is through DoorDash. ${DOORDASH_PAGE(c)} Prices on DoorDash can differ from prices on this website, and DoorDash’s own fees and terms apply.`,
        "Shipping is not available through this website at the moment.",
        "Sales tax is shown at checkout before you pay.",
      ].join("\n\n"),
    openTerms: [
      "How much notice ordinary orders and custom baskets need (the website starts with placeholder values of 24 and 48 hours), and the pickup hours and closed dates.",
      "What counts as a large, holiday or special order, and how much notice those need.",
      "How long a ready order is held, and what happens to an order that is not collected.",
      "Whether and when shipping will be offered online, and where it could go.",
      "The shop’s DoorDash page link (Store settings), so the delivery section can point to it.",
    ],
  },
  {
    slug: "cancellations-and-refunds",
    field: "cancellationsAndRefunds",
    title: "Cancellations and refunds",
    summary: "Cancelling an order or custom basket, and asking for a refund.",
    draft: () =>
      [
        "To cancel an order or ask for a refund, please contact the shop as soon as you can and tell us your order or reservation number.",
        "Cancellation and refund requests for custom orders, including reserved custom baskets, are reviewed by shop staff. A custom basket is reserved with a deposit, shown before you reserve, and the rest is paid when you pick it up. Whether the deposit can be refunded is being finalised.",
        "How long you have to cancel, how much of a payment can be refunded, and how an approved refund is paid back are being finalised. For any other order, please contact the shop to ask about cancelling.",
        "Event inquiries, such as a chocolate fountain, are requests only. Nothing is booked or charged on this website. The shop confirms availability with you, and the deposit and cancellation terms for events are being finalised.",
      ].join("\n\n"),
    openTerms: [
      "How long after ordering, or before pickup, a customer may cancel an ordinary order.",
      "Whether the custom-basket deposit can be refunded, and when (for example before the basket is assembled and after).",
      "How much can be refunded once a custom basket has been assembled, and whether fresh or perishable items can be refunded at all.",
      "How an approved refund is paid back and how long it takes.",
      "Cancellation and deposit terms for events such as the chocolate fountain (the “free cancellation within one week” wording is ambiguous).",
    ],
  },
  {
    slug: "substitutions-and-dietary-requests",
    field: "substitutionsAndDietaryRequests",
    title: "Substitutions and dietary requests",
    summary: "Changes to an order, dietary requests and allergies.",
    showsAllergyNotice: true,
    draft: () =>
      [
        "If we need to replace a significant item in your order or basket, we will contact you before making the change.",
        "Dietary requests depend on the products we have available and are not guarantees. A dietary or special request that comes with a custom basket is reviewed by shop staff, and we may contact you to confirm it before your basket is finalised.",
        "If you have a food allergy, please contact us before you order. Our allergy notice is below.",
      ].join("\n\n"),
    openTerms: [
      "What counts as a “significant” substitution, as opposed to a minor one.",
      "How long the shop waits for a reply, and what happens if the customer cannot be reached.",
      "Whether a customer can decline a substitution and cancel with a refund.",
    ],
  },
  {
    slug: "damaged-or-missing-items",
    field: "damagedOrMissingItems",
    title: "Damaged or missing items",
    summary: "What to do if something in your order is damaged or missing.",
    draft: () =>
      [
        "If something in your order is damaged or missing, please tell us as soon as you can. Contact the shop with your order or reservation number and what is wrong, so we can look into it.",
        "The deadline for reporting a problem, how a report is reviewed, and what the shop will do to put things right are being finalised. In the meantime, please contact the shop.",
      ].join("\n\n"),
    openTerms: [
      "The deadline for reporting a damaged or missing item (for example at pickup, or within a number of days).",
      "What the shop offers: a replacement, a refund, a credit, or a mix, and who decides.",
      "The escalation process if the customer is not satisfied.",
      "Whether the customer must send photos.",
      "How a problem with a DoorDash delivery is handled: by the shop or by DoorDash.",
    ],
  },
  {
    slug: "privacy",
    field: "privacy",
    title: "Privacy",
    summary: "What this website collects and how the shop uses it.",
    draft: () =>
      [
        "When you place an order or reserve a custom basket, we ask for your name, email address and phone number, the pickup time you choose, and any notes you want to give the shop. For a custom basket we also keep the basket you built, your gift message and any dietary or special requests.",
        "When you send an inquiry through the contact form or an event inquiry form, we collect your name, email address, phone number, your message and any event details you enter.",
        "The shop uses this information to prepare your order or reservation, to contact you about it (for example before a significant substitution), and to answer your inquiry.",
        "While you shop, your bag is kept on our server. Your browser holds a random code in a cookie that lasts up to 30 days, so the site can find your bag again. The code contains no personal details and no prices. When you reserve a custom basket, a second cookie that lasts 2 hours carries the basket you are reserving. We do not use cookies for advertising or tracking.",
        "This website does not use third-party trackers or analytics.",
        "We do not store card numbers or security codes on this website. Card payments are handled by a payment provider, and we keep only a reference to the payment.",
        "Local delivery orders are placed on DoorDash’s own page, not on this website. DoorDash’s own terms and privacy practices apply to what you share with them.",
        "How long we keep this information, and how to ask us to see, correct or delete it, are being finalised. Until then, please contact the shop with any privacy question or request.",
      ].join("\n\n"),
    openTerms: [
      "How long order, reservation and inquiry details are kept.",
      "How a customer asks to see, correct or delete their information.",
      "Who besides the shop’s staff can see it once the payment provider and email sending are connected.",
    ],
  },
];

/** Looks a policy up by URL slug. Unknown slugs (including prototype names) return undefined. */
export function getPolicyDefinition(slug: string): PolicyDefinition | undefined {
  return POLICIES.find((p) => p.slug === slug);
}

/** What the global stores per policy (everything optional: a fresh database holds nothing). */
export type StoredPolicy = {
  title?: string | null;
  body?: string | null;
  approved?: boolean | null;
  lastReviewed?: string | null;
};
export type StoredPolicies = Partial<Record<PolicyField, StoredPolicy | null>> | null | undefined;

export const PENDING_MESSAGE = "This policy is being finalised. Please contact us with any questions.";
export const DRAFT_BANNER_TITLE = "Draft — awaiting Lody’s approval";

/**
 * What the page shows:
 * - `approved`: Lody’s saved text, ticked approved. The only text the live site ever shows.
 * - `saved`: Lody’s saved text, not yet approved (staging only).
 * - `draft`: the built-in draft wording, nothing saved yet (staging only).
 * - `pending`: the live site’s “being finalised” message.
 */
export type PolicyView = "approved" | "saved" | "draft" | "pending";

export type ResolvedPolicy = {
  slug: PolicySlug;
  title: string;
  view: PolicyView;
  /** Body paragraphs. Empty for `pending`. */
  paragraphs: string[];
  /** Show the “Draft — awaiting Lody’s approval” banner. */
  banner: boolean;
  /** Terms still to be decided; only for the built-in draft on staging. */
  openTerms: readonly string[];
  /** ISO date, only for approved text. */
  lastReviewed: string | null;
  showsAllergyNotice: boolean;
};

export type ResolveEnv = {
  /** `isStaging()`: anything other than APP_ENV=production. */
  staging: boolean;
  contact: ContactFacts;
};

/** A blank line starts a new paragraph, as on the About page. */
export function toParagraphs(text: string): string[] {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Decides what a visitor sees for one policy.
 *
 * Live: approved text with a non-empty body, otherwise the “being finalised” message. The live site
 * never shows the draft wording or text that has not been approved. Staging: any saved text, or the
 * built-in draft when nothing is saved, with the draft banner whenever it is not approved.
 * An “approved” policy with a blank body counts as not approved. Unknown slugs return null.
 */
export function resolvePolicy(slug: string, stored: StoredPolicies, env: ResolveEnv): ResolvedPolicy | null {
  const def = getPolicyDefinition(slug);
  if (!def) return null;

  const entry = stored?.[def.field] ?? null;
  const body = entry?.body?.trim() ?? "";
  const approved = entry?.approved === true && body !== "";
  const storedTitle = entry?.title?.trim() || "";
  const base = { slug: def.slug, showsAllergyNotice: def.showsAllergyNotice === true };

  if (approved) {
    return { ...base, title: storedTitle || def.title, view: "approved", paragraphs: toParagraphs(body), banner: false, openTerms: [], lastReviewed: entry?.lastReviewed ?? null };
  }
  if (!env.staging) {
    return { ...base, title: def.title, view: "pending", paragraphs: [], banner: false, openTerms: [], lastReviewed: null };
  }
  if (body !== "") {
    return { ...base, title: storedTitle || def.title, view: "saved", paragraphs: toParagraphs(body), banner: true, openTerms: [], lastReviewed: null };
  }
  return {
    ...base,
    title: storedTitle || def.title,
    view: "draft",
    paragraphs: toParagraphs(def.draft(env.contact)),
    banner: true,
    openTerms: def.openTerms,
    lastReviewed: null,
  };
}

/** Every policy, in display order. */
export function resolveAllPolicies(stored: StoredPolicies, env: ResolveEnv): ResolvedPolicy[] {
  return POLICIES.map((p) => resolvePolicy(p.slug, stored, env)).filter((p): p is ResolvedPolicy => p !== null);
}

/** Index-page status, shown on staging only. */
export function policyStatusLabel(view: PolicyView): string {
  switch (view) {
    case "approved":
      return "Approved";
    case "saved":
      return `${DRAFT_BANNER_TITLE} (text saved, not approved)`;
    case "draft":
      return `${DRAFT_BANNER_TITLE} (built-in wording)`;
    case "pending":
      return "Being finalised";
  }
}

/** “October 6, 2026” from an ISO date, or null if it is missing or invalid. Dates are date-only, so UTC. */
export function formatReviewed(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(date);
}

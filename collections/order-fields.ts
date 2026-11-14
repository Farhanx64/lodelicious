import type { Field, FieldAccess } from "payload";

import { commerceField } from "../src/access/roles";
import { centsComponents } from "../src/fields/money";

/** Snapshot fields: written once by checkout, never editable afterwards (PRD OPS 02). */
export const frozen: { update: FieldAccess } = { update: () => false };

export const customerFields: Field = {
  name: "customer",
  type: "group",
  access: frozen,
  fields: [
    {
      type: "row",
      fields: [
        { name: "name", type: "text", required: true },
        { name: "email", type: "email", required: true },
        { name: "phone", type: "text", required: true },
      ],
    },
  ],
};

export const pickupFields: Field = {
  name: "pickup",
  type: "group",
  access: frozen,
  fields: [
    {
      type: "row",
      fields: [
        { name: "date", type: "text", required: true, index: true },
        { name: "start", type: "text", required: true },
        { name: "end", type: "text", required: true },
      ],
    },
    { name: "label", label: "Time slot", type: "text" },
  ],
};

/**
 * Pickup or shipping (D54). A shipped record has no pickup time: its `pickup` group holds the day
 * it was placed with "Ships by mail" as the label, because those columns are required.
 */
export const fulfillmentFields: Field = {
  name: "fulfillment",
  label: "Pickup or shipping",
  type: "group",
  access: frozen,
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "method",
          type: "select",
          defaultValue: "pickup",
          index: true,
          options: [
            { label: "Pickup in the shop", value: "pickup" },
            { label: "Ship by mail", value: "ship" },
          ],
        },
        { name: "shippingCents", label: "Shipping charged", type: "number", defaultValue: 0, min: 0, admin: { components: centsComponents } },
      ],
    },
    {
      type: "row",
      admin: { condition: (data) => data?.fulfillment?.method === "ship" },
      fields: [
        {
          name: "box",
          label: "Box to pack",
          type: "text",
          admin: { readOnly: true, description: "Picked by checkout from the order's weight (Settings → Shipping → Boxes, D60)." },
        },
        { name: "weightLbs", label: "Order weight (lbs)", type: "number", admin: { readOnly: true, description: "Quantity × each item's shipping weight. Empty when an item had no weight." } },
      ],
    },
    {
      name: "shipTo",
      label: "Ship to",
      type: "group",
      admin: { condition: (data) => data?.fulfillment?.method === "ship" },
      fields: [
        { type: "row", fields: [{ name: "name", type: "text" }, { name: "line1", label: "Street address", type: "text" }, { name: "line2", label: "Apt, suite (optional)", type: "text" }] },
        { type: "row", fields: [{ name: "city", type: "text" }, { name: "state", type: "text" }, { name: "zip", label: "ZIP", type: "text" }] },
      ],
    },
  ],
};

export const identityFields: Field[] = [
  // The page title already shows the number, so the field itself sits in the sidebar.
  { name: "number", type: "text", required: true, unique: true, index: true, access: frozen, admin: { position: "sidebar" } },
  { name: "accessTokenHash", type: "text", required: true, access: { read: () => false, update: () => false }, admin: { hidden: true } },
  { name: "idempotencyKey", type: "text", required: true, unique: true, index: true, access: { update: () => false }, admin: { hidden: true } },
  {
    name: "testMode",
    label: "Test order",
    type: "checkbox",
    defaultValue: false,
    access: frozen,
    admin: {
      description: "Placed with the test payment on staging — no money moved. Never pack or ship a test order.",
      position: "sidebar",
      components: { Cell: "@/components/admin/TestOrderCell#TestOrderCell" },
    },
  },
];

/**
 * How many times checkout has asked the payment provider for this record (D42). Each attempt
 * after a decline uses a new provider idempotency key (`<record key>:<attempt>`); a retry that
 * follows an unknown result never charges again until staff reconcile it.
 */
export const paymentAttempts: Field = {
  name: "paymentAttempts",
  label: "Payment attempts",
  type: "number",
  defaultValue: 0,
  min: 0,
  access: frozen,
  admin: { position: "sidebar", readOnly: true, description: "Set by checkout." },
};

export const paymentReference: Field = {
  name: "payment",
  type: "group",
  access: frozen,
  admin: { position: "sidebar" },
  fields: [
    { name: "provider", type: "text" },
    { name: "reference", type: "text" },
    {
      name: "providerOrderId",
      label: "Clover order",
      type: "text",
      admin: { description: "The order on Lody's Clover account (D54). Look it up there before marking an unknown payment paid or failed." },
    },
  ],
};

/** Payment state may be changed only by Lody and Faisal (PRD OPS 01: refunds). */
export const paymentStatusAccess = { update: commerceField };

/**
 * Where the record stands with the shelf (D40). Written by checkout, never by customers. A
 * record that was paid but whose stock could not be taken is flagged `needs_attention` and kept:
 * staff fix the stock, then mark it resolved. Cancelling never restocks.
 */
export const stockStatusField: Field = {
  name: "stockStatus",
  label: "Stock",
  type: "select",
  defaultValue: "none",
  index: true,
  access: { update: commerceField },
  options: [
    { label: "Not tracked (placed before stock tracking)", value: "none" },
    { label: "Held while paying", value: "held" },
    { label: "Taken from stock", value: "committed" },
    { label: "Needs attention: paid, but stock could not be taken", value: "needs_attention" },
    { label: "Released (payment did not complete)", value: "released" },
    { label: "Resolved by staff", value: "resolved" },
  ],
  admin: {
    position: "sidebar",
    description: "Set by checkout. If this says Needs attention, the order is paid and kept: check the shelf and the stock count, then mark it Resolved. Cancelling an order never puts stock back.",
  },
};

/** The detail behind the stock status, shown on the record's Stock tab. */
export const stockDetailFields: Field[] = [
  { name: "stockOwner", type: "text", access: frozen, admin: { hidden: true } },
  { name: "stockNote", label: "Stock note", type: "textarea", access: frozen, admin: { readOnly: true, description: "Why this needs attention. Empty when nothing went wrong." } },
  {
    name: "stockPlan",
    label: "Taken from stock",
    type: "json",
    access: frozen,
    admin: { readOnly: true, description: "The components this takes from stock (a basket with contents takes its parts, not itself). Use it when putting cancelled stock back." },
  },
];

export const staffNotesField: Field = { name: "staffNotes", label: "Staff notes", type: "textarea", admin: { description: "Internal. Never shown to customers." } };

/** Description of the tab that holds the raw snapshot an order or reservation was saved with. */
export const RECORD_DATA_NOTE = "Exactly what was saved when the customer checked out. Read-only; the first tab shows the same information in plain form.";

const sentAt = (name: string, label: string): Field => ({ name, label, type: "date", access: frozen, admin: { readOnly: true, date: { pickerAppearance: "dayAndTime" } } });

/**
 * Which emails have gone out (D44, D64). Written only by `src/lib/email/notify.ts`, which claims a marker with
 * one conditional UPDATE before sending, so a repeated save, a staff edit or a retry never sends twice. A
 * marker left empty means "not sent yet": the retry script sends it. Orders also record the "shipped"
 * email; reservations have no shipped status.
 */
export function orderEmailFields(collection: "orders" | "reservations"): Field {
  return {
    name: "emails",
    label: "Emails sent",
    type: "group",
    access: frozen,
    admin: { position: "sidebar", description: "Set by the system when an email is sent. Empty means not sent yet." },
    fields: [
      sentAt("confirmationSentAt", "Customer confirmation"),
      sentAt("staffNotifiedAt", "Staff told of new paid record"),
      sentAt("unknownNotifiedAt", "Staff told payment is unknown"),
      sentAt("attentionNotifiedAt", "Staff told stock needs attention"),
      sentAt("readySentAt", "Customer told it is ready for pickup"),
      ...(collection === "orders" ? [sentAt("shippedSentAt", "Customer told it has shipped")] : []),
    ],
  };
}

/** Carriers a shipped order can name (D64); the email links to the carrier's tracking page. */
export const TRACKING_CARRIERS = [
  { label: "USPS", value: "usps" },
  { label: "UPS", value: "ups" },
  { label: "FedEx", value: "fedex" },
  { label: "Other", value: "other" },
] as const;

/** Tracking for a shipped order (D64). Staff fill these in before saving the order as Shipped. */
export const trackingFields: Field = {
  type: "row",
  admin: { condition: (data) => data?.fulfillment?.method === "ship" || data?.fulfillmentStatus === "shipped" },
  fields: [
    {
      name: "trackingCarrier",
      label: "Carrier",
      type: "select",
      options: [...TRACKING_CARRIERS],
      admin: { description: "Fill in before saving Shipped: the shipped email links to this carrier's tracking page." },
    },
    {
      name: "trackingNumber",
      label: "Tracking number",
      type: "text",
      maxLength: 64,
      admin: { description: "As printed on the label. Optional; without it the email says the parcel is on its way." },
    },
  ],
};

export const inquiryEmailFields: Field = {
  name: "emails",
  label: "Emails sent",
  type: "group",
  access: frozen,
  admin: { position: "sidebar", description: "Set by the system when an email is sent. Empty means not sent yet." },
  fields: [sentAt("confirmationSentAt", "Customer receipt"), sentAt("staffNotifiedAt", "Staff notified")],
};

/**
 * The rewards member who placed this record, and its points (D47). Frozen at checkout: earning,
 * returning and taking back points all use these numbers, never today's settings.
 */
export function rewardsFields(collection: "orders" | "reservations"): Field {
  return {
    name: "rewards",
    label: "Rewards",
    type: "group",
    access: frozen,
    admin: { position: "sidebar", description: "Set by checkout when a signed-in member placed this. Points move when the payment is paid, fails or is refunded." },
    fields: [
      { name: "member", type: "relationship", relationTo: "members", index: true, admin: { readOnly: true } },
      ...(collection === "orders"
        ? [{ name: "redeemedPoints", label: "Points spent", type: "number" as const, admin: { readOnly: true } }]
        : []),
      {
        name: "earnPoints",
        label: collection === "orders" ? "Points to earn when paid" : "Points to earn when paid in full",
        type: "number",
        admin: { readOnly: true },
      },
    ],
  };
}

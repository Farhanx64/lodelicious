import type { Field, FieldAccess } from "payload";

import { commerceField } from "../src/access/roles";

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
 * Which emails have gone out (D44). Written only by `src/lib/email/notify.ts`, which claims a marker with
 * one conditional UPDATE before sending, so a repeated save, a staff edit or a retry never sends twice. A
 * marker left empty means "not sent yet": the retry script sends it.
 */
export const orderEmailFields: Field = {
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

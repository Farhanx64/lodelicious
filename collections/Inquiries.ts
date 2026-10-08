import type { CollectionConfig, Field } from "payload";

import { isOwner, isStaff, nobody } from "../src/access/roles";
import { auditCollection, auditDelete } from "../src/hooks/audit";
import { INQUIRY_STATUSES, INQUIRY_TOPICS, MAX_LOCATION_LENGTH, MAX_MESSAGE_LENGTH, STATUS_LABELS, TOPIC_LABELS } from "../src/lib/inquiries/shared";
import { MAX_GUESTS, MIN_GUESTS } from "../src/lib/inquiries/estimate";

import { customerFields, frozen } from "./order-fields";

const cents = { components: { Cell: "@/components/admin/CentsCell#CentsCell" } };
const isFountain = (data: Partial<{ topic: string }> | undefined) => data?.topic === "fountain";

/** Event details are collected for the chocolate fountain only; the parser enforces them, not the database. */
const eventFields: Field = {
  name: "event",
  label: "Event",
  type: "group",
  access: frozen,
  admin: { condition: isFountain, description: "As entered by the customer. Staff confirm availability before anything is booked." },
  fields: [
    {
      type: "row",
      fields: [
        { name: "date", label: "Event date", type: "text", admin: { description: "YYYY-MM-DD" } },
        { name: "setupTime", label: "Preferred setup time", type: "text", admin: { description: "24-hour time, e.g. 14:30" } },
        { name: "guests", type: "number", min: MIN_GUESTS, max: MAX_GUESTS, admin: { step: 1 } },
      ],
    },
    { name: "location", type: "text", maxLength: MAX_LOCATION_LENGTH },
  ],
};

/**
 * Staff-review inquiries (D37): general questions, products and presentations that can't be
 * bought online (Baby White, Cowboy, filled ceramics, seasonal gift boxes) and chocolate-fountain
 * requests. Created only by the server (`src/lib/inquiries/service.ts`); what the customer wrote
 * is frozen, and staff move the status along and keep notes.
 */
export const Inquiries: CollectionConfig = {
  slug: "inquiries",
  labels: { singular: "Inquiry", plural: "Inquiries" },
  admin: {
    useAsTitle: "number",
    group: "Orders",
    defaultColumns: ["number", "topic", "customer.name", "itemTitle", "status", "createdAt"],
    listSearchableFields: ["number", "customer.name", "customer.email", "itemTitle"],
  },
  defaultSort: "-createdAt",
  // Only the server creates inquiries (overrideAccess); nobody can post one straight to the API.
  access: { read: isStaff, create: nobody, update: isStaff, delete: isOwner },
  // The audit log records who moved an inquiry along, never the customer's own words or contact details.
  hooks: { afterChange: [auditCollection(["status", "staffNotes"])], afterDelete: [auditDelete(["number", "status"])] },
  fields: [
    { name: "number", type: "text", required: true, unique: true, index: true, access: frozen },
    { name: "sequence", type: "number", required: true, unique: true, index: true, access: frozen, admin: { hidden: true } },
    { name: "idempotencyKey", type: "text", required: true, unique: true, index: true, access: { update: () => false }, admin: { hidden: true } },
    {
      type: "row",
      fields: [
        {
          name: "status",
          type: "select",
          required: true,
          defaultValue: "new",
          index: true,
          options: INQUIRY_STATUSES.map((value) => ({ label: STATUS_LABELS[value], value })),
        },
        {
          name: "topic",
          type: "select",
          required: true,
          index: true,
          access: frozen,
          options: INQUIRY_TOPICS.map((value) => ({ label: TOPIC_LABELS[value], value })),
        },
      ],
    },
    customerFields,
    { name: "message", type: "textarea", maxLength: MAX_MESSAGE_LENGTH, access: frozen },
    {
      type: "row",
      fields: [
        { name: "product", type: "relationship", relationTo: "products", access: frozen, admin: { description: "The product the customer asked about." } },
        { name: "itemTitle", label: "Product title (at the time)", type: "text", access: frozen },
      ],
    },
    eventFields,
    {
      name: "estimateCents",
      label: "Estimate (before tax)",
      type: "number",
      access: frozen,
      admin: {
        condition: isFountain,
        ...cents,
        description: "Worked out by the server when the inquiry arrived: base + per-guest x guests. An estimate only; staff confirm the final price, tax and any other approved charges.",
      },
    },
    {
      name: "estimateTerms",
      label: "Terms used for the estimate",
      type: "json",
      access: frozen,
      admin: { condition: isFountain, description: "The fountain prices and deposit percentage in force when the inquiry arrived." },
    },
    { name: "staffNotes", type: "textarea", admin: { description: "Internal. Never shown to customers." } },
  ],
};

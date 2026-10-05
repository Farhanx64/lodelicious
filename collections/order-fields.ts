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
    { name: "label", type: "text" },
  ],
};

export const identityFields: Field[] = [
  { name: "number", type: "text", required: true, unique: true, index: true, access: frozen },
  { name: "accessTokenHash", type: "text", required: true, access: { read: () => false, update: () => false }, admin: { hidden: true } },
  { name: "idempotencyKey", type: "text", required: true, unique: true, index: true, access: { update: () => false }, admin: { hidden: true } },
  {
    name: "testMode",
    type: "checkbox",
    defaultValue: false,
    access: frozen,
    admin: { description: "Placed with the test payment on staging — no money moved.", position: "sidebar" },
  },
];

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

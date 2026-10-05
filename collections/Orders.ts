import type { CollectionConfig } from "payload";

import { isOwner, isStaff, nobody } from "../src/access/roles";
import { auditCollection } from "../src/hooks/audit";

import { customerFields, frozen, identityFields, paymentReference, paymentStatusAccess, pickupFields } from "./order-fields";

/**
 * Shop orders (D35). Created only by checkout through the Local API; the lines and totals are an
 * immutable snapshot, so later catalog edits never change what a customer bought (PRD OPS 02).
 * Payment and fulfillment are tracked separately.
 */
export const Orders: CollectionConfig = {
  slug: "orders",
  labels: { singular: "Order", plural: "Orders" },
  admin: {
    useAsTitle: "number",
    group: "Orders",
    defaultColumns: ["number", "customer.name", "pickup.label", "paymentStatus", "fulfillmentStatus", "totals.totalCents", "testMode"],
    listSearchableFields: ["number", "customer.name", "customer.email"],
  },
  access: { read: isStaff, create: nobody, update: isStaff, delete: isOwner },
  hooks: { afterChange: [auditCollection(["paymentStatus", "fulfillmentStatus", "staffNotes"])] },
  fields: [
    ...identityFields,
    {
      type: "row",
      fields: [
        {
          name: "paymentStatus",
          type: "select",
          required: true,
          defaultValue: "pending",
          access: paymentStatusAccess,
          options: [
            { label: "Pending payment", value: "pending" },
            { label: "Paid", value: "paid" },
            { label: "Failed", value: "failed" },
            { label: "Refunded", value: "refunded" },
          ],
        },
        {
          name: "fulfillmentStatus",
          type: "select",
          required: true,
          defaultValue: "preparing",
          options: [
            { label: "Needs staff review", value: "staff_review" },
            { label: "Preparing", value: "preparing" },
            { label: "Ready for pickup", value: "ready" },
            { label: "Completed", value: "completed" },
            { label: "Canceled", value: "canceled" },
          ],
        },
      ],
    },
    customerFields,
    pickupFields,
    { name: "notes", label: "Customer notes", type: "textarea", access: frozen },
    { name: "lines", type: "json", required: true, access: frozen, admin: { description: "What was bought, at the prices charged." } },
    {
      name: "totals",
      type: "group",
      access: frozen,
      fields: [
        {
          type: "row",
          fields: [
            { name: "subtotalCents", type: "number", required: true, admin: { components: { Cell: "@/components/admin/CentsCell#CentsCell" } } },
            { name: "taxCents", type: "number", required: true },
            { name: "totalCents", type: "number", required: true, admin: { components: { Cell: "@/components/admin/CentsCell#CentsCell" } } },
          ],
        },
        { name: "taxApproved", type: "checkbox", admin: { description: "False: tax was an estimate from an unapproved class." } },
      ],
    },
    paymentReference,
    { name: "staffNotes", type: "textarea" },
  ],
};

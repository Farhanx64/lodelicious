import type { CollectionConfig } from "payload";

import { isOwner, isStaff, nobody } from "../src/access/roles";
import { centsComponents } from "../src/fields/money";
import { auditCollection, auditDelete } from "../src/hooks/audit";
import { advanceWhenPaid } from "../src/hooks/payment-status";
import { sendRecordEmails } from "../src/hooks/send-emails";
import { guardStockStatus, releaseHoldOnCancel } from "../src/hooks/stock-status";

import {
  RECORD_DATA_NOTE,
  customerFields,
  frozen,
  identityFields,
  orderEmailFields,
  paymentAttempts,
  paymentReference,
  paymentStatusAccess,
  pickupFields,
  staffNotesField,
  stockDetailFields,
  stockStatusField,
} from "./order-fields";

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
    description: "Shop orders for pickup. An order marked TEST was placed with the test payment: never pack it.",
    defaultColumns: ["number", "testMode", "customer.name", "pickup.label", "fulfillmentStatus", "paymentStatus", "stockStatus", "totals.totalCents"],
    listSearchableFields: ["number", "customer.name", "customer.email"],
  },
  defaultSort: "-createdAt",
  access: { read: isStaff, create: nobody, update: isStaff, delete: isOwner },
  hooks: {
    beforeChange: [guardStockStatus, advanceWhenPaid("orders")],
    afterChange: [auditCollection(["paymentStatus", "fulfillmentStatus", "stockStatus", "staffNotes"]), releaseHoldOnCancel("fulfillmentStatus"), sendRecordEmails("orders")],
    afterDelete: [auditDelete(["number", "paymentStatus", "fulfillmentStatus", "stockStatus", "testMode"])],
  },
  fields: [
    ...identityFields,
    {
      type: "row",
      fields: [
        {
          name: "fulfillmentStatus",
          label: "Fulfillment status",
          type: "select",
          required: true,
          defaultValue: "awaiting_payment",
          options: [
            { label: "Awaiting payment (do not pack)", value: "awaiting_payment" },
            { label: "Needs staff review", value: "staff_review" },
            { label: "Preparing", value: "preparing" },
            { label: "Ready for pickup", value: "ready" },
            { label: "Completed", value: "completed" },
            { label: "Canceled", value: "canceled" },
          ],
        },
        {
          name: "paymentStatus",
          label: "Payment status",
          type: "select",
          required: true,
          defaultValue: "pending",
          access: paymentStatusAccess,
          options: [
            { label: "Pending payment", value: "pending" },
            { label: "Paid", value: "paid" },
            { label: "Failed", value: "failed" },
            { label: "Unknown: check with the payment provider", value: "unknown" },
            { label: "Refunded", value: "refunded" },
          ],
        },
      ],
    },
    {
      type: "tabs",
      tabs: [
        {
          label: "Order",
          fields: [
            customerFields,
            pickupFields,
            { name: "summary", type: "ui", admin: { components: { Field: "@/components/admin/RecordSummary#OrderSummary" } } },
            { name: "notes", label: "Customer notes", type: "textarea", access: frozen },
            staffNotesField,
          ],
        },
        { label: "Stock", fields: stockDetailFields },
        {
          label: "Record data",
          admin: { description: RECORD_DATA_NOTE },
          fields: [
            { name: "lines", label: "Items", type: "json", required: true, access: frozen, admin: { description: "What was bought, at the prices charged." } },
            {
              name: "totals",
              type: "group",
              access: frozen,
              fields: [
                {
                  type: "row",
                  fields: [
                    { name: "subtotalCents", label: "Subtotal", type: "number", required: true, admin: { components: centsComponents } },
                    { name: "taxCents", label: "Tax", type: "number", required: true, admin: { components: centsComponents } },
                    { name: "totalCents", label: "Total", type: "number", required: true, admin: { components: centsComponents } },
                  ],
                },
                { name: "taxApproved", label: "Tax rate approved", type: "checkbox", admin: { description: "Unticked: the tax was an estimate from an unapproved tax class." } },
              ],
            },
          ],
        },
      ],
    },
    // Sidebar
    stockStatusField,
    paymentReference,
    paymentAttempts,
    orderEmailFields,
  ],
};

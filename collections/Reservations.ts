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

const cents = { components: centsComponents };

/**
 * Custom basket reservations (D36): Build a Basket is reserved with a deposit, then packed for
 * pickup. The basket contents, prices and assembly instructions are an immutable snapshot.
 */
export const Reservations: CollectionConfig = {
  slug: "reservations",
  labels: { singular: "Basket reservation", plural: "Basket reservations" },
  admin: {
    useAsTitle: "number",
    group: "Orders",
    description: "Custom baskets reserved through Build a Basket. Pack from the assembly instructions. One marked TEST was placed with the test payment: never pack it.",
    defaultColumns: ["number", "testMode", "customer.name", "pickup.label", "reservationStatus", "paymentStatus", "stockStatus", "amountPaidCents", "balanceDueCents"],
    listSearchableFields: ["number", "customer.name", "customer.email"],
  },
  defaultSort: "-createdAt",
  access: { read: isStaff, create: nobody, update: isStaff, delete: isOwner },
  hooks: {
    beforeChange: [guardStockStatus, advanceWhenPaid("reservations")],
    afterChange: [auditCollection(["paymentStatus", "reservationStatus", "stockStatus", "amountPaidCents", "balanceDueCents", "staffNotes"]), releaseHoldOnCancel("reservationStatus"), sendRecordEmails("reservations")],
    afterDelete: [auditDelete(["number", "paymentStatus", "reservationStatus", "stockStatus", "testMode"])],
  },
  fields: [
    ...identityFields,
    {
      type: "row",
      fields: [
        {
          name: "reservationStatus",
          label: "Reservation status",
          type: "select",
          required: true,
          defaultValue: "awaiting_payment",
          options: [
            { label: "Awaiting deposit (do not pack)", value: "awaiting_payment" },
            { label: "Needs staff review", value: "staff_review" },
            { label: "Confirmed", value: "confirmed" },
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
          defaultValue: "deposit_pending",
          access: paymentStatusAccess,
          options: [
            { label: "Deposit pending", value: "deposit_pending" },
            { label: "Deposit paid", value: "deposit_paid" },
            { label: "Paid in full", value: "paid_in_full" },
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
          label: "Reservation",
          fields: [
            customerFields,
            pickupFields,
            {
              name: "assembly",
              label: "Assembly instructions",
              type: "textarea",
              access: frozen,
              admin: { description: "What to pack, the gift message and any customer requests." },
            },
            { name: "summary", type: "ui", admin: { components: { Field: "@/components/admin/RecordSummary#ReservationSummary" } } },
            {
              type: "row",
              fields: [
                { name: "amountPaidCents", label: "Paid so far", type: "number", required: true, access: paymentStatusAccess, admin: { ...cents, description: "In cents." } },
                { name: "balanceDueCents", label: "Balance due at pickup", type: "number", required: true, access: paymentStatusAccess, admin: { ...cents, description: "In cents. Not worked out automatically: change it together with Paid so far." } },
              ],
            },
            staffNotesField,
          ],
        },
        { label: "Stock", fields: stockDetailFields },
        {
          label: "Record data",
          admin: { description: RECORD_DATA_NOTE },
          fields: [
            { name: "basket", type: "json", required: true, access: frozen, admin: { description: "The basket as reserved: request, components, prices and rules." } },
            {
              type: "row",
              fields: [
                { name: "totalCents", label: "Basket total", type: "number", required: true, access: frozen, admin: cents },
                { name: "taxCents", label: "Tax", type: "number", required: true, access: frozen, admin: cents },
                { name: "depositCents", label: "Charged when reserved", type: "number", required: true, access: frozen, admin: cents },
              ],
            },
            { name: "taxApproved", label: "Tax rate approved", type: "checkbox", access: frozen },
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

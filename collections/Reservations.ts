import type { CollectionConfig } from "payload";

import { isOwner, isStaff, nobody } from "../src/access/roles";
import { auditCollection, auditDelete } from "../src/hooks/audit";
import { advanceWhenPaid } from "../src/hooks/payment-status";
import { sendRecordEmails } from "../src/hooks/send-emails";
import { guardStockStatus, releaseHoldOnCancel } from "../src/hooks/stock-status";

import { customerFields, frozen, identityFields, inventoryFields, orderEmailFields, paymentAttempts, paymentReference, paymentStatusAccess, pickupFields } from "./order-fields";

const cents = { components: { Cell: "@/components/admin/CentsCell#CentsCell" } };

/**
 * Custom basket reservations (D36): Build a Basket is reserved with a deposit, then packed for
 * pickup. The basket contents, prices and assembly instructions are an immutable snapshot.
 */
export const Reservations: CollectionConfig = {
  slug: "reservations",
  labels: { singular: "Reservation", plural: "Reservations" },
  admin: {
    useAsTitle: "number",
    group: "Orders",
    defaultColumns: ["number", "testMode", "customer.name", "pickup.label", "reservationStatus", "paymentStatus", "stockStatus", "amountPaidCents", "balanceDueCents"],
    listSearchableFields: ["number", "customer.name", "customer.email"],
  },
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
    customerFields,
    pickupFields,
    {
      name: "assembly",
      label: "Assembly instructions",
      type: "textarea",
      access: frozen,
      admin: { description: "What to pack, the gift message and any customer requests." },
    },
    { name: "basket", type: "json", required: true, access: frozen, admin: { description: "The basket as reserved: request, components, prices and rules." } },
    {
      type: "row",
      fields: [
        { name: "totalCents", label: "Basket total", type: "number", required: true, access: frozen, admin: cents },
        { name: "taxCents", label: "Tax", type: "number", required: true, access: frozen },
        { name: "depositCents", label: "Deposit", type: "number", required: true, access: frozen, admin: cents },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "amountPaidCents", label: "Paid so far", type: "number", required: true, access: paymentStatusAccess, admin: cents },
        { name: "balanceDueCents", label: "Balance due at pickup", type: "number", required: true, access: paymentStatusAccess, admin: cents },
      ],
    },
    { name: "taxApproved", type: "checkbox", access: frozen },
    paymentReference,
    paymentAttempts,
    ...inventoryFields,
    orderEmailFields,
    { name: "staffNotes", type: "textarea" },
  ],
};

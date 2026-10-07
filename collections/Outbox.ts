import type { CollectionConfig } from "payload";

import { isStaff, nobody } from "../src/access/roles";
import { OUTBOX_EVENT_TYPES, OUTBOX_STATUSES } from "../src/lib/inventory/types";

/**
 * Durable outbox for the Clover stock sync (INV 06, D10, D40). Every stock movement writes one
 * `stock_changed` event in the same transaction as the movement, so a crash can never lose a
 * change. This is the website half: a later worker sends the events, records the outcome here
 * and retries transient failures with bounded backoff. Nothing processes it yet.
 */
export const Outbox: CollectionConfig = {
  slug: "outbox",
  labels: { singular: "Outbox event", plural: "Outbox events" },
  admin: {
    useAsTitle: "idempotencyKey",
    group: "Inventory",
    defaultColumns: ["createdAt", "eventType", "status", "attempts", "nextAttemptAt", "lastError"],
    description: "Stock changes waiting to be sent to Clover, and the result of each attempt. Read-only.",
  },
  defaultSort: "-createdAt",
  access: { read: isStaff, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: "eventType", type: "select", required: true, defaultValue: "stock_changed", options: OUTBOX_EVENT_TYPES.map((value) => ({ label: value.replace(/_/g, " "), value })) },
    {
      name: "payload",
      type: "json",
      required: true,
      admin: { description: "productId, cloverId, variantKey, delta, quantityAfter, movementId, reason, reference." },
    },
    { name: "status", type: "select", required: true, defaultValue: "pending", index: true, options: OUTBOX_STATUSES.map((value) => ({ label: value, value })) },
    { name: "attempts", type: "number", defaultValue: 0, min: 0 },
    { name: "nextAttemptAt", type: "date", index: true, admin: { description: "Not before this time. Empty once sent or dead." } },
    { name: "lastAttemptAt", type: "date" },
    { name: "sentAt", type: "date" },
    { name: "lastError", type: "textarea" },
    { name: "idempotencyKey", type: "text", required: true, unique: true, index: true, admin: { description: "One event per movement. Also the key to send to Clover." } },
  ],
};

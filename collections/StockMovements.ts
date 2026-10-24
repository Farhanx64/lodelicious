import type { CollectionConfig } from "payload";

import { isStaff, nobody } from "../src/access/roles";
import { MOVEMENT_REASONS } from "../src/lib/inventory/types";

/**
 * The stock ledger (INV 01, D40): one append-only row per change to a counted quantity, written
 * only by the inventory server code in the same database transaction as the change. Nobody can
 * create, edit or delete a row through the admin or the API, so the history can't be rewritten.
 */
export const StockMovements: CollectionConfig = {
  slug: "stock-movements",
  labels: { singular: "Stock movement", plural: "Stock movements" },
  admin: {
    useAsTitle: "reference",
    group: "Inventory",
    defaultColumns: ["createdAt", "productTitle", "variantKey", "delta", "quantityAfter", "reason", "reference"],
    listSearchableFields: ["productTitle", "reference", "note"],
    description: "Every change to a stock count, newest first. Read-only: record counts and adjustments under Stock adjustments.",
  },
  defaultSort: "-createdAt",
  access: { read: isStaff, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: "product", type: "relationship", relationTo: "products", index: true },
    { name: "productTitle", type: "text", admin: { description: "The name when it moved, kept if the product is later deleted." } },
    { name: "variantKey", label: "Option", type: "text", defaultValue: "", admin: { description: "Empty for the product itself." } },
    { name: "delta", type: "number", required: true, admin: { description: "Units added (+) or removed (−)." } },
    { name: "reason", type: "select", required: true, index: true, options: MOVEMENT_REASONS.map((value) => ({ label: value.replace(/_/g, " "), value })) },
    { name: "quantityAfter", type: "number", required: true, admin: { description: "The counted quantity once this movement was applied." } },
    { name: "reference", type: "text", index: true, admin: { description: "Order or reservation number, or the adjustment it came from." } },
    { name: "user", type: "relationship", relationTo: "users", admin: { description: "The staff member, when a person caused it." } },
    { name: "note", type: "textarea" },
    {
      name: "idempotencyKey",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "One per component of one record, so the same stock can never move twice." },
    },
  ],
};

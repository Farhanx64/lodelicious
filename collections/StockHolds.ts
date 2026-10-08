import type { CollectionConfig } from "payload";

import { isStaff, nobody } from "../src/access/roles";
import { HOLD_STATUSES } from "../src/lib/inventory/types";

/**
 * Short-lived reservations of stock while a customer is paying (INV 04, D40). A hold never
 * changes the counted quantity; it only lowers what other customers can buy until it expires.
 * Expired holds are ignored wherever sellable stock is worked out and cleaned up by
 * `scripts/release-expired-holds.ts`. Written only by the inventory server code.
 */
export const StockHolds: CollectionConfig = {
  slug: "stock-holds",
  labels: { singular: "Checkout hold", plural: "Checkout holds" },
  admin: {
    useAsTitle: "key",
    group: "Inventory",
    defaultColumns: ["createdAt", "product", "variantKey", "quantity", "status", "expiresAt", "reference"],
    description: "Stock set aside for a checkout in progress. Read-only; holds expire by themselves.",
  },
  defaultSort: "-createdAt",
  access: { read: isStaff, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: "key", type: "text", required: true, unique: true, index: true, admin: { description: "owner | product | option: one hold per owner and component." } },
    { name: "product", type: "relationship", relationTo: "products", index: true },
    { name: "variantKey", label: "Option", type: "text", defaultValue: "" },
    { name: "quantity", type: "number", required: true, min: 1 },
    { name: "owner", type: "text", required: true, index: true, admin: { description: "The bag or basket checkout that holds it." } },
    { name: "reference", type: "text", admin: { description: "Order or reservation number, once there is one." } },
    { name: "status", type: "select", required: true, defaultValue: "active", index: true, options: HOLD_STATUSES.map((value) => ({ label: value, value })) },
    { name: "expiresAt", label: "Expires", type: "date", required: true, index: true, admin: { date: { pickerAppearance: "dayAndTime" } } },
  ],
};

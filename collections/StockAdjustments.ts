import type { CollectionConfig } from "payload";

import { isStaff, nobody } from "../src/access/roles";
import { auditCollection } from "../src/hooks/audit";
import { applyAdjustment } from "../src/hooks/stock-adjustment";
import { ADJUSTMENT_KINDS } from "../src/lib/inventory/types";

const KIND_LABELS: Record<(typeof ADJUSTMENT_KINDS)[number], string> = {
  count: "Stock count (set the quantity to what was counted)",
  adjust: "Adjustment (add or remove units)",
  cancel_restock: "Put cancelled stock back (restock)",
};

/**
 * How staff change stock (D40). The product's stock fields are read-only, because a form saved
 * from an old page would overwrite sales made in the meantime. Instead staff add a row here:
 * the server applies it to the live count in one atomic step, writes the ledger entry and the
 * outbox event, and refuses anything that would take stock below zero. Rows can't be edited or
 * deleted afterwards, so each one is also the record of who changed what and why.
 */
export const StockAdjustments: CollectionConfig = {
  slug: "stock-adjustments",
  labels: { singular: "Stock adjustment", plural: "Stock adjustments" },
  admin: {
    useAsTitle: "kind",
    group: "Inventory",
    defaultColumns: ["createdAt", "kind", "product", "variantKey", "countedQuantity", "delta", "note"],
    description:
      "Record a stock count, add or remove units, or put cancelled stock back. A cancelled order never restocks by itself, and a refund is decided separately.",
  },
  defaultSort: "-createdAt",
  // Counts and adjustments are for the owner and managers; any staff member may put back a non-perishable item.
  access: { read: isStaff, create: isStaff, update: nobody, delete: nobody },
  hooks: {
    beforeChange: [applyAdjustment],
    afterChange: [auditCollection(["kind", "product", "variantKey", "countedQuantity", "delta", "order", "reservation", "restockLines", "note"])],
  },
  fields: [
    { name: "kind", type: "select", required: true, defaultValue: "count", options: ADJUSTMENT_KINDS.map((value) => ({ label: KIND_LABELS[value], value })) },
    {
      type: "row",
      admin: { condition: (data) => data?.kind === "count" || data?.kind === "adjust" },
      fields: [
        { name: "product", type: "relationship", relationTo: "products", admin: { description: "Choose the product, or the component itself for a basket's parts." } },
        { name: "variantKey", label: "Option", type: "text", admin: { description: "The option code (e.g. pink) when the product has options. Otherwise leave empty." } },
      ],
    },
    {
      name: "countedQuantity",
      label: "Counted quantity",
      type: "number",
      min: 0,
      admin: {
        step: 1,
        condition: (data) => data?.kind === "count",
        description:
          "How many are on the shelf and free to sell now. Leave out units set aside for paid online orders that haven't been packed yet: they were already taken off the stored number when the order was paid, so counting them would let the shop sell them twice (count after packing, or subtract them). This replaces the stored number, marks it counted now and ends any \"unknown\" state.",
      },
    },
    {
      name: "delta",
      label: "Change",
      type: "number",
      admin: { step: 1, condition: (data) => data?.kind === "adjust", description: "Units to add (for example 12) or remove (for example -2). The count can't go below zero." },
    },
    {
      type: "row",
      admin: { condition: (data) => data?.kind === "cancel_restock" },
      fields: [
        { name: "order", type: "relationship", relationTo: "orders", admin: { description: "The order being put back. Choose an order or a reservation, not both." } },
        { name: "reservation", type: "relationship", relationTo: "reservations" },
      ],
    },
    {
      name: "restockLines",
      label: "Components to put back",
      type: "array",
      labels: { singular: "Component", plural: "Components" },
      admin: {
        condition: (data) => data?.kind === "cancel_restock",
        description:
          "Choose only what is still unopened and fit to sell: opened, assembled or perishable goods do not go back automatically. The order's \"Taken from stock\" field lists what it took.",
      },
      fields: [
        {
          type: "row",
          fields: [
            { name: "product", type: "relationship", relationTo: "products", required: true },
            { name: "variantKey", label: "Option", type: "text" },
            { name: "quantity", type: "number", required: true, min: 1, admin: { step: 1 } },
          ],
        },
      ],
    },
    {
      name: "confirmPerishable",
      label: "I confirm any perishable items are unopened and still fit to sell",
      type: "checkbox",
      defaultValue: false,
      admin: { condition: (data) => data?.kind === "cancel_restock", description: "Perishable items go back only when the owner or a manager ticks this." },
    },
    { name: "note", type: "textarea", required: true, admin: { description: "Why. For example: the shelf count date, or which customer cancelled." } },
    { name: "user", type: "relationship", relationTo: "users", admin: { readOnly: true, position: "sidebar", description: "Filled in automatically." } },
    { name: "requestId", type: "text", admin: { readOnly: true, hidden: true } },
    {
      name: "result",
      label: "What changed",
      type: "json",
      admin: { readOnly: true, description: "Filled in automatically: each component's change and new quantity." },
    },
  ],
};

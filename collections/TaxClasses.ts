import type { CollectionConfig } from "payload";

import { isCommerceManager, isStaff } from "../src/access/roles";
import { auditCollection, auditDelete } from "../src/hooks/audit";

/**
 * Sales tax classes (D34). Lody approves each rate; until every class in a sale is approved,
 * checkout shows tax as an estimate and live orders stay closed.
 */
export const TaxClasses: CollectionConfig = {
  slug: "tax-classes",
  labels: { singular: "Tax class", plural: "Tax classes" },
  admin: { useAsTitle: "name", group: "Settings", defaultColumns: ["name", "rateBasisPoints", "approved"] },
  access: { read: isStaff, create: isCommerceManager, update: isCommerceManager, delete: isCommerceManager },
  hooks: {
    afterChange: [auditCollection(["name", "rateBasisPoints", "approved"])],
    afterDelete: [auditDelete(["name", "rateBasisPoints", "approved"])],
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "rateBasisPoints",
      label: "Rate (basis points)",
      type: "number",
      required: true,
      min: 0,
      max: 10000,
      admin: { description: "625 = 6.25%. Use 0 for tax-exempt items." },
      validate: (v: number | null | undefined) => (Number.isSafeInteger(v) ? true : "Enter a whole number, e.g. 625 for 6.25%"),
    },
    {
      name: "approved",
      type: "checkbox",
      defaultValue: false,
      admin: { description: "Tick only once you have confirmed this rate applies to the products using it." },
    },
    { name: "notes", type: "textarea" },
  ],
};

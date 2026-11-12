import type { Field, GlobalConfig } from "payload";

import { isCommerceManager, isStaff } from "../src/access/roles";
import { withCents } from "../src/fields/money";
import { auditGlobal } from "../src/hooks/audit";
import { DEFAULT_SHIPPING } from "../src/lib/shipping/rates";

const rate = (name: keyof typeof DEFAULT_SHIPPING, label: string, description: string): Field =>
  withCents({
    name,
    label,
    type: "number",
    required: true,
    min: 0,
    defaultValue: DEFAULT_SHIPPING[name] as number,
    admin: { description, step: 1 },
    validate: (v: number | null | undefined) => (Number.isSafeInteger(v) && (v as number) >= 0 ? true : "Enter whole cents (895 for $8.95)"),
  } as Field);

/**
 * Shipping rates (D54). One charge per order: the highest single rate that applies to anything in
 * it, never the sum. Pickup is always free. Products ship only when ticked "Can ship" and not
 * "Perishable / prepared" (Products → Fulfillment).
 */
export const ShippingSettings: GlobalConfig = {
  slug: "shipping-settings",
  label: "Shipping",
  admin: { group: "Settings", description: "Shipping rates for shop orders and gift baskets. An order pays one shipping charge: the highest rate that applies to anything in it, never the rates added together. Pickup is always free." },
  access: { read: isStaff, update: isCommerceManager },
  hooks: { afterChange: [auditGlobal(["shippingEnabled", "flatRateCents", "basketSmallCents", "basketMediumCents", "basketLargeCents", "basketLargerCents"])] },
  fields: [
    {
      name: "shippingEnabled",
      label: "Offer shipping at checkout",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description:
          "Untick to offer pickup only. Even when ticked, an order can ship only if every item in it is ticked \"Can ship\" and is not perishable (Products → Fulfillment).",
      },
    },
    {
      type: "collapsible",
      label: "Regular products",
      fields: [rate("flatRateCents", "Flat rate", "Charged once for an order of regular (non-basket) products, however many there are. 895 = $8.95.")],
    },
    {
      type: "collapsible",
      label: "Gift baskets, by size",
      admin: {
        description:
          "Used for Build a Basket and for ready-made baskets in the Gift baskets category. A ready-made basket's size is read from its name (Small, Medium, Large, Extra large); one without a size word uses the larger-size rate.",
      },
      fields: [
        {
          type: "row",
          fields: [
            rate("basketSmallCents", "Small basket", "1000 = $10.00."),
            rate("basketMediumCents", "Medium basket", "1500 = $15.00."),
            rate("basketLargeCents", "Large basket", "2000 = $20.00."),
            rate("basketLargerCents", "Any larger basket", "Extra large and anything bigger. 2500 = $25.00."),
          ],
        },
      ],
    },
  ],
};

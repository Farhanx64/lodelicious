import type { Field, GlobalConfig } from "payload";

import { isCommerceManager, isStaff } from "../src/access/roles";
import { withCents } from "../src/fields/money";
import { auditGlobal } from "../src/hooks/audit";
import { DEFAULT_BOXES } from "../src/lib/shipping/boxes";
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

const inches = (name: string, label: string): Field => ({
  name,
  label,
  type: "number",
  min: 0,
  admin: { step: 0.5, width: "25%" },
});

/** Lody's boxes (D60): the smallest one that holds the order's weight is the box to pack. */
const boxesField: Field = {
  name: "boxes",
  label: "Boxes",
  type: "array",
  defaultValue: DEFAULT_BOXES.map((b) => ({ ...b })),
  labels: { singular: "Box", plural: "Boxes" },
  admin: {
    initCollapsed: false,
    description:
      "Checkout adds up the order's weight (quantity × each product's Shipping weight) and picks the smallest box whose maximum weight holds it. The box is shown on the order so staff know what to pack. Size (inches) is for staff; only the weight decides the fit.",
  },
  fields: [
    {
      type: "row",
      fields: [
        { name: "name", label: "Box name", type: "text", required: true, admin: { width: "40%" } },
        {
          name: "maxWeightLbs",
          label: "Max weight (lbs)",
          type: "number",
          required: true,
          min: 0,
          admin: { step: 0.25, width: "30%", description: "The heaviest order this box takes, e.g. 3 for a 2–3 lb box." },
          validate: (v: number | null | undefined) => (typeof v === "number" && v > 0 ? true : "Enter the box's maximum weight in pounds, above 0"),
        },
        withCents({
          name: "priceCents",
          label: "Price",
          type: "number",
          required: true,
          min: 0,
          admin: { step: 1, width: "30%", description: "Charged only when \"Charge by box\" is ticked. 1000 = $10.00." },
          validate: (v: number | null | undefined) => (Number.isSafeInteger(v) && (v as number) >= 0 ? true : "Enter whole cents (1000 for $10.00)"),
        } as Field),
      ],
    },
    { type: "row", fields: [inches("lengthIn", "Length (in)"), inches("widthIn", "Width (in)"), inches("heightIn", "Height (in)")] },
  ],
};

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
  hooks: { afterChange: [auditGlobal(["shippingEnabled", "flatRateCents", "basketSmallCents", "basketMediumCents", "basketLargeCents", "basketLargerCents", "chargeByBox", "boxes"])] },
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
    {
      type: "collapsible",
      label: "Boxes by weight",
      fields: [
        {
          name: "chargeByBox",
          label: "Charge by box",
          type: "checkbox",
          defaultValue: DEFAULT_SHIPPING.chargeByBox,
          admin: {
            description:
              "Ticked: an order that fits a box pays that box's price instead of the rates above. Unticked: the rates above are charged and the box is only shown to staff. Either way, if any item has no Shipping weight, or the order is heavier than the largest box, the rates above are charged and staff choose the box by hand.",
          },
        },
        boxesField,
      ],
    },
  ],
};

import { APIError, type Field, type GlobalBeforeChangeHook, type GlobalConfig } from "payload";

import { anyone, isCommerceManager } from "../src/access/roles";
import { DEFAULT_GIFT_SETTINGS, GiftSettingsError, parseSettings } from "../src/lib/gifts/defaults";
import { GIFT_TYPES, SIZE_CODES, SPECIAL_CODES } from "../src/lib/gifts/types";
import { auditGlobal } from "../src/hooks/audit";

const GIFT_TYPE_OPTIONS = [
  { label: "Sweet", value: "sweet" },
  { label: "Savory", value: "savory" },
  { label: "Sweet & savory", value: "sweet_savory" },
  { label: "Sympathy", value: "sympathy" },
] satisfies { label: string; value: (typeof GIFT_TYPES)[number] }[];

const SIZE_OPTIONS = [
  { label: "Small", value: "small" },
  { label: "Medium", value: "medium" },
  { label: "Large", value: "large" },
  { label: "Extra large", value: "extra_large" },
] satisfies { label: string; value: (typeof SIZE_CODES)[number] }[];

const SPECIAL_OPTIONS = [
  { label: "Cowboy Basket", value: "cowboy" },
  { label: "Baby White Basket", value: "baby_white" },
  { label: "Filled ceramic basket", value: "ceramic_filled" },
] satisfies { label: string; value: (typeof SPECIAL_CODES)[number] }[];

const cents = (name: string, label: string, required = true): Field => ({
  name,
  label,
  type: "number",
  required,
  min: 0,
  admin: { description: "In cents: 2995 = $29.95", step: 1 },
});

const whole = (name: string, label: string, required = true, description?: string): Field => ({
  name,
  label,
  type: "number",
  required,
  min: 0,
  admin: { step: 1, ...(description ? { description } : {}) },
});

/** Reject rule sets the engine can't use, with the same messages the engine would give. */
const validateRules: GlobalBeforeChangeHook = ({ data }) => {
  try {
    parseSettings(data);
  } catch (err) {
    if (err instanceof GiftSettingsError) throw new APIError(err.message, 400, undefined, true);
    throw err;
  }
  return data;
};

export const GiftBuilderSettings: GlobalConfig = {
  slug: "gift-builder-settings",
  label: "Gift builder rules",
  admin: {
    group: "Gift builder",
    description:
      "Rules for custom baskets. The customer's budget covers contents and packaging; tax and delivery are added at checkout.",
  },
  access: {
    read: anyone,
    update: isCommerceManager,
  },
  hooks: {
    beforeChange: [validateRules],
    afterChange: [auditGlobal(["budgetNotice", "sizes", "countOverrides", "specialPresentations"])],
  },
  fields: [
    {
      name: "budgetNotice",
      type: "textarea",
      required: true,
      defaultValue:
        "Your budget covers the gift's contents and its basket and packaging. Sales tax and delivery or shipping are added at checkout.",
      admin: { description: "Shown to customers before they start choosing products." },
    },
    {
      name: "sizes",
      label: "Basket sizes (custom builder)",
      type: "array",
      minRows: 1,
      defaultValue: DEFAULT_GIFT_SETTINGS.sizes,
      fields: [
        {
          type: "row",
          fields: [
            { name: "code", type: "select", required: true, options: SIZE_OPTIONS },
            { name: "label", type: "text", required: true },
            { name: "basketSizeIn", label: "Basket size (inches)", type: "text" },
          ],
        },
        {
          type: "row",
          fields: [
            whole("minItems", "Minimum items"),
            whole("maxItems", "Maximum items"),
            whole("premiumCap", "Premium maximum"),
          ],
        },
        {
          type: "row",
          fields: [
            cents("packagingCents", "Basket & packaging fee"),
            whole("capacityUnits", "Fit capacity", false, "Leave empty until products are measured; counts still apply."),
          ],
        },
      ],
    },
    {
      name: "countOverrides",
      label: "Item-count exceptions by gift type",
      type: "array",
      defaultValue: DEFAULT_GIFT_SETTINGS.countOverrides,
      admin: { description: "From the basket chart: large sympathy baskets hold 13–16 items." },
      fields: [
        {
          type: "row",
          fields: [
            { name: "giftType", type: "select", required: true, options: GIFT_TYPE_OPTIONS },
            { name: "size", type: "select", required: true, options: SIZE_OPTIONS },
            whole("minItems", "Minimum items"),
            whole("maxItems", "Maximum items"),
          ],
        },
      ],
    },
    {
      name: "specialPresentations",
      label: "Special presentations",
      type: "array",
      defaultValue: DEFAULT_GIFT_SETTINGS.specialPresentations.map((p) => ({
        ...p,
        includedComponents: p.includedComponents.map((value) => ({ value })),
        allowedCategories: p.allowedCategories.map((value) => ({ value })),
      })),
      admin: {
        description:
          "Cowboy, Baby White and filled ceramics have their own rules and never get the standard packaging fee. They stay inquiry-only until a price and premium maximum are set.",
      },
      fields: [
        {
          type: "row",
          fields: [
            { name: "code", type: "select", required: true, options: SPECIAL_OPTIONS },
            { name: "name", type: "text", required: true },
            {
              name: "status",
              type: "select",
              required: true,
              defaultValue: "inquiry",
              options: [
                { label: "Available to order", value: "available" },
                { label: "Inquiry only", value: "inquiry" },
                { label: "Disabled", value: "disabled" },
              ],
            },
          ],
        },
        {
          type: "row",
          fields: [
            cents("basePriceCents", "Base price", false),
            {
              name: "pricing",
              type: "select",
              required: true,
              defaultValue: "base_plus_contents",
              options: [
                { label: "Base price + chosen items", value: "base_plus_contents" },
                { label: "Fixed price (includes chosen items)", value: "fixed" },
              ],
            },
          ],
        },
        {
          type: "row",
          fields: [
            whole("minSelections", "Minimum selections"),
            whole("maxSelections", "Maximum selections"),
            whole("premiumCap", "Premium maximum", false),
            whole("capacityUnits", "Fit capacity", false),
          ],
        },
        {
          name: "includedComponents",
          type: "array",
          labels: { singular: "Included component", plural: "Included components" },
          admin: { description: "Come with the presentation and don't count as selections." },
          fields: [{ name: "value", label: "Component", type: "text", required: true }],
        },
        {
          name: "allowedCategories",
          type: "array",
          labels: { singular: "Allowed category", plural: "Allowed categories" },
          admin: { description: "Leave empty to allow any basket item." },
          fields: [{ name: "value", label: "Category", type: "text", required: true }],
        },
      ],
    },
  ],
};

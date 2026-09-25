import type { GlobalConfig } from "payload";

import { anyone, isCommerceManager } from "../src/access/roles";
import { auditGlobal } from "../src/hooks/audit";

/**
 * Public business details. Defaults are the values Lody confirmed in the client brief
 * (September 24, 2026) so a fresh database renders correct contact information.
 */
export const StoreSettings: GlobalConfig = {
  slug: "store-settings",
  label: "Store settings",
  admin: {
    group: "Settings",
  },
  access: {
    read: anyone,
    update: isCommerceManager,
  },
  hooks: {
    afterChange: [auditGlobal(["name", "street", "locality", "phone", "email", "timezone", "hours", "closedDays"])],
  },
  fields: [
    { name: "name", type: "text", required: true, defaultValue: "Lodelicious Gifts & Sweets" },
    {
      type: "row",
      fields: [
        { name: "street", type: "text", required: true, defaultValue: "24 Manomet Point Rd." },
        { name: "locality", type: "text", required: true, defaultValue: "Plymouth, MA 02360" },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "phone", type: "text", required: true, defaultValue: "(774) 283-4676" },
        { name: "email", type: "email", required: true, defaultValue: "lodelicious1@gmail.com" },
      ],
    },
    { name: "timezone", type: "text", required: true, defaultValue: "America/New_York" },
    { name: "hoursLabel", type: "text", required: true, defaultValue: "Fall & winter hours" },
    {
      name: "hours",
      type: "array",
      labels: { singular: "Opening hours row", plural: "Opening hours" },
      defaultValue: [
        { days: "Mon–Thu", time: "11 AM – 6 PM" },
        { days: "Fri–Sat", time: "11 AM – 7 PM" },
        { days: "Sun", time: "11 AM – 5 PM" },
      ],
      fields: [
        {
          type: "row",
          fields: [
            { name: "days", type: "text", required: true },
            { name: "time", type: "text", required: true },
          ],
        },
      ],
    },
    {
      name: "closedDays",
      type: "array",
      labels: { singular: "Closed day", plural: "Closed days" },
      defaultValue: [{ label: "Christmas Day" }, { label: "New Year’s Day" }, { label: "Labor Day" }],
      fields: [{ name: "label", type: "text", required: true }],
    },
  ],
};

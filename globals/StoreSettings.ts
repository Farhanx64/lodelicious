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
    afterChange: [auditGlobal(["name", "tagline", "street", "locality", "phone", "email", "timezone", "hours", "closedDays", "allergyNotice", "doordashUrl", "storyHeading", "story"])],
  },
  fields: [
    {
      type: "row",
      fields: [
        // Brand from Lody's mood board (D31); shown in the header lockup, page titles and footer.
        { name: "name", label: "Shop name", type: "text", required: true, defaultValue: "Souset-Pink" },
        { name: "tagline", type: "text", defaultValue: "Sweets · Chocolates · Gifts", admin: { description: "Shown in small capitals under the name." } },
      ],
    },
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
    {
      name: "doordashUrl",
      label: "DoorDash store page",
      type: "text",
      admin: {
        description:
          "Local delivery is through DoorDash (Lody, 2026-09-30). Paste the shop's DoorDash link to show it on the site; leave empty to hide the link.",
      },
      validate: (value: string | null | undefined) =>
        !value || /^https:\/\/(www\.)?doordash\.com\//.test(value) ? true : "Use the shop's https://www.doordash.com/… link",
    },
    { name: "storyHeading", label: "Story heading", type: "text", defaultValue: "Our story" },
    {
      name: "story",
      label: "Our story",
      type: "textarea",
      admin: {
        description:
          "A few sentences about the shop for the bottom of every page, in your own words. Leave empty to hide it. A blank line starts a new paragraph.",
      },
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
      name: "allergyNotice",
      type: "textarea",
      required: true,
      defaultValue:
        "Our chocolates and fudge contain common allergens and may be made in facilities that process nuts and other allergens. We cannot guarantee products are completely free from traces of nuts or other allergens. Please contact us before ordering if you have a food allergy or specific dietary requirement so we can check current product information.",
      admin: { description: "Shown on every product page. From Lody's allergen chart (2026-09-26)." },
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

import type { GlobalConfig } from "payload";

import { anyone, isCommerceManager } from "../src/access/roles";
import { auditGlobal } from "../src/hooks/audit";

/**
 * Public business details. Defaults are the values Lody confirmed in the client brief
 * (September 24, 2026) so a fresh database renders correct contact information.
 */
export const StoreSettings: GlobalConfig = {
  slug: "store-settings",
  label: "Store details",
  admin: {
    group: "Website",
    description: "The shop's name, contact details, opening hours and story as customers see them across the website.",
  },
  access: {
    read: anyone,
    update: isCommerceManager,
  },
  hooks: {
    afterChange: [auditGlobal(["name", "tagline", "street", "locality", "phone", "email", "notificationEmail", "timezone", "hours", "closedDays", "allergyNotice", "doordashUrl", "storyHeading", "story"])],
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Shop & contact",
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
                { name: "locality", label: "Town, state and ZIP", type: "text", required: true, defaultValue: "Plymouth, MA 02360" },
              ],
            },
            {
              type: "row",
              fields: [
                { name: "phone", type: "text", required: true, defaultValue: "(774) 283-4676" },
                { name: "email", label: "Shop email", type: "email", required: true, defaultValue: "lodelicious1@gmail.com" },
              ],
            },
            {
              name: "notificationEmail",
              label: "Staff notification email",
              type: "email",
              admin: {
                description:
                  "Where new orders, reservations, inquiries and anything needing attention are emailed to staff (D44). Leave empty to use the shop email above. Nothing is sent until a sending service is approved and connected.",
              },
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
          ],
        },
        {
          label: "Opening hours",
          admin: {
            description:
              "Shown in the footer and on the Contact page. Display only: the pickup times customers can choose, and the dates they can't, are under Settings → Checkout & reservations.",
          },
          fields: [
            { name: "hoursLabel", label: "Heading", type: "text", required: true, defaultValue: "Fall & winter hours" },
            {
              name: "hours",
              label: "Opening hours",
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
              label: "Closed days (shown on the site)",
              type: "array",
              labels: { singular: "Closed day", plural: "Closed days" },
              defaultValue: [{ label: "Christmas Day" }, { label: "New Year’s Day" }, { label: "Labor Day" }],
              admin: { description: "Names only, listed with the hours. To stop pickups on a date, add it under Settings → Checkout & reservations → Pickup times → Closed dates." },
              fields: [{ name: "label", type: "text", required: true }],
            },
            {
              name: "timezone",
              type: "text",
              required: true,
              defaultValue: "America/New_York",
              admin: { readOnly: true, description: "For reference only. Pickup dates and times always use the shop's time zone, America/New_York." },
            },
          ],
        },
        {
          label: "Story & allergy notice",
          fields: [
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
            {
              name: "allergyNotice",
              label: "Allergy notice",
              type: "textarea",
              required: true,
              defaultValue:
                "Our chocolates and fudge contain common allergens and may be made in facilities that process nuts and other allergens. We cannot guarantee products are completely free from traces of nuts or other allergens. Please contact us before ordering if you have a food allergy or specific dietary requirement so we can check current product information.",
              admin: { description: "Shown on every product page. From Lody's allergen chart (2026-09-26)." },
            },
          ],
        },
      ],
    },
  ],
};

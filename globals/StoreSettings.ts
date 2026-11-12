import type { GlobalConfig } from "payload";

import { anyone, isCommerceManager } from "../src/access/roles";
import { BRAND_COLOR_DEFAULT, BUTTON_COLOR_DEFAULT, validateBrandColor, validateButtonColor } from "../src/lib/brand-color";
import { auditGlobal } from "../src/hooks/audit";
import { GOOGLE_RATING_DEFAULT, GOOGLE_REVIEW_COUNT_DEFAULT, GOOGLE_REVIEW_URL_DEFAULT, validateGoogleRating } from "../src/lib/reviews/shared";

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
    afterChange: [auditGlobal(["name", "tagline", "brandColor", "buttonColor", "promoEnabled", "promoSlides", "promoSeconds", "street", "locality", "phone", "email", "notificationEmail", "timezone", "hours", "closedDays", "allergyNotice", "doordashUrl", "googleRating", "googleReviewCount", "googleReviewUrl", "storyHeading", "story"])],
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
              name: "brandColor",
              label: "Brand colour",
              type: "text",
              defaultValue: BRAND_COLOR_DEFAULT,
              validate: validateBrandColor,
              admin: {
                placeholder: BRAND_COLOR_DEFAULT,
                components: { Field: { path: "@/components/admin/ColorPickerField#ColorPickerField", clientProps: { kind: "brand" } } },
                description:
                  "The main pink on the website: the announcement bar, buttons and coloured panels. A colour code like #9c4459. It must be deep enough for white text on it to stay readable; leave empty for the default.",
              },
            },
            {
              name: "buttonColor",
              label: "Button colour",
              type: "text",
              defaultValue: BUTTON_COLOR_DEFAULT,
              validate: validateButtonColor,
              admin: {
                placeholder: BUTTON_COLOR_DEFAULT,
                components: { Field: { path: "@/components/admin/ColorPickerField#ColorPickerField", clientProps: { kind: "button" } } },
                description:
                  "The filled buttons (gold by default), such as Shop sweets and Add to bag. A colour code like #c8a467. It must be light enough for the dark button text to stay readable; leave empty for the default.",
              },
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
          label: "Google reviews",
          admin: {
            description:
              "The reviews carousel on the home page (D52). The reviews themselves are under Website → Reviews; nothing here is fetched from Google, so update the rating and count by hand now and then.",
          },
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "googleRating",
                  label: "Google rating",
                  type: "text",
                  defaultValue: GOOGLE_RATING_DEFAULT,
                  validate: validateGoogleRating,
                  admin: { description: "As Google shows it, e.g. 5.0 or 4.8. Leave empty to hide the rating line." },
                },
                {
                  name: "googleReviewCount",
                  label: "Number of Google reviews",
                  type: "number",
                  min: 0,
                  defaultValue: GOOGLE_REVIEW_COUNT_DEFAULT,
                  admin: { step: 1 },
                },
              ],
            },
            {
              name: "googleReviewUrl",
              label: "Google review link",
              type: "text",
              defaultValue: GOOGLE_REVIEW_URL_DEFAULT,
              admin: {
                description:
                  "Where the “Leave us a review on Google” button goes. Best is the link from Google Business Profile → Ask for reviews (https://g.page/r/…/review), which opens the review box directly. Leave empty to hide the button.",
              },
              validate: (value: string | null | undefined) => (!value || /^https:\/\/\S+$/.test(value.trim()) ? true : "Paste the full https:// link from Google"),
            },
          ],
        },
        {
          label: "Promo banner",
          admin: {
            description:
              "The ribbon across the very top of every page. Each slide shows for a few seconds, then slides to the next; customers can also swipe or use the arrows.",
          },
          fields: [
            { name: "promoEnabled", label: "Show the promo banner", type: "checkbox", defaultValue: true },
            {
              name: "promoSlides",
              label: "Slides",
              type: "array",
              labels: { singular: "Slide", plural: "Slides" },
              maxRows: 8,
              defaultValue: [
                { text: "November fall deals — fall baskets are coming in", linkUrl: "/shop", linkLabel: "Shop fall" },
                { text: "Thanksgiving baskets are in season. Choose your basket now", linkUrl: "/build-a-basket", linkLabel: "Choose your basket" },
              ],
              admin: { description: "Drag to reorder. Keep each line short so it fits on a phone." },
              fields: [
                { name: "text", label: "Message", type: "text", required: true, maxLength: 120 },
                {
                  type: "row",
                  fields: [
                    {
                      name: "linkUrl",
                      label: "Link (optional)",
                      type: "text",
                      admin: { description: "A page on this site such as /shop or /build-a-basket, or a full https:// link." },
                      validate: (value: string | null | undefined) =>
                        !value || /^\/(?!\/)/.test(value) || /^https:\/\//.test(value) ? true : "Start with / for a page on this site, or https://",
                    },
                    { name: "linkLabel", label: "Link text", type: "text", maxLength: 30, admin: { description: "Defaults to “Shop now”." } },
                  ],
                },
              ],
            },
            { name: "promoSeconds", label: "Seconds per slide", type: "number", defaultValue: 5, min: 3, max: 20, admin: { step: 1 } },
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

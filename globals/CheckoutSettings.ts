import type { Field, GlobalConfig } from "payload";

import { isCommerceManager, isStaff } from "../src/access/roles";
import { withCents } from "../src/fields/money";
import { auditGlobal } from "../src/hooks/audit";

const whole = (name: string, label: string, defaultValue: number, description: string): Field => ({
  name,
  label,
  type: "number",
  required: true,
  min: 0,
  defaultValue,
  admin: { description, step: 1 },
  validate: (v: number | null | undefined) => (Number.isSafeInteger(v) && (v as number) >= 0 ? true : "Enter a whole number"),
});

const time = (name: string, label: string): Field => ({
  name,
  label,
  type: "text",
  required: true,
  admin: { description: "24-hour time, e.g. 11:00 or 18:30" },
  validate: (v: string | null | undefined) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v ?? "") ? true : "Use HH:MM, e.g. 11:00"),
});

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Checkout, pickup and basket-deposit rules (D34–D36). Seeded values are starting points to
 * confirm with Lody; all of them are editable here.
 */
export const CheckoutSettings: GlobalConfig = {
  slug: "checkout-settings",
  label: "Checkout & reservations",
  admin: { group: "Settings", description: "Default tax classes, pickup times and closed dates, and the deposit for basket reservations." },
  access: { read: isStaff, update: isCommerceManager },
  hooks: {
    afterChange: [
      auditGlobal([
        "defaultTaxClass",
        "packagingTaxClass",
        "pickupHours",
        "slotMinutes",
        "leadTimeHours",
        "reservationLeadHours",
        "daysAhead",
        "closedDates",
        "depositType",
        "depositPercentBasisPoints",
        "depositFlatCents",
        "allowPayInFull",
      ]),
    ],
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Tax",
          fields: [
            { name: "defaultTaxClass", label: "Default tax class", type: "relationship", relationTo: "tax-classes", admin: { description: "Used for products without their own tax class." } },
            { name: "packagingTaxClass", label: "Basket & packaging tax class", type: "relationship", relationTo: "tax-classes", admin: { description: "Used for basket & packaging fees." } },
          ],
        },
        {
          label: "Pickup times",
          fields: [
            {
              name: "pickupHours",
              type: "array",
              labels: { singular: "Pickup day", plural: "Pickup hours" },
              admin: { description: "Starting values copied from the shop hours — confirm with Lody." },
              defaultValue: [
                ...[1, 2, 3, 4].map((weekday) => ({ weekday: String(weekday), open: "11:00", close: "18:00" })),
                ...[5, 6].map((weekday) => ({ weekday: String(weekday), open: "11:00", close: "19:00" })),
                { weekday: "0", open: "11:00", close: "17:00" },
              ],
              fields: [
                {
                  type: "row",
                  fields: [
                    { name: "weekday", type: "select", required: true, options: WEEKDAYS.map((label, i) => ({ label, value: String(i) })) },
                    time("open", "From"),
                    time("close", "Until"),
                  ],
                },
              ],
            },
            {
              type: "row",
              fields: [
                whole("slotMinutes", "Pickup window (minutes)", 60, "Length of each pickup time customers choose."),
                whole("leadTimeHours", "Shop orders: hours notice", 24, "Earliest pickup after an order is placed. Confirm with Lody."),
                whole("reservationLeadHours", "Baskets: hours notice", 48, "Earliest pickup for a basket reservation. Confirm with Lody."),
                whole("daysAhead", "Book up to (days ahead)", 14, "How far ahead customers can choose a pickup time."),
              ],
            },
            {
              name: "closedDates",
              type: "array",
              labels: { singular: "Closed date", plural: "Closed dates" },
              fields: [
                {
                  name: "date",
                  type: "text",
                  required: true,
                  admin: { description: "YYYY-MM-DD" },
                  validate: (v: string | null | undefined) => (/^\d{4}-\d{2}-\d{2}$/.test(v ?? "") ? true : "Use YYYY-MM-DD"),
                },
                { name: "label", type: "text" },
              ],
            },
          ],
        },
        {
          label: "Basket deposits",
          fields: [
            {
              name: "depositType",
              type: "radio",
              required: true,
              defaultValue: "percent",
              options: [
                { label: "Percentage of the basket total", value: "percent" },
                { label: "Flat amount per basket", value: "flat" },
              ],
            },
            {
              type: "row",
              fields: [
                whole("depositPercentBasisPoints", "Deposit percentage (basis points)", 2500, "2500 = 25%. Used when the deposit is a percentage."),
                withCents(whole("depositFlatCents", "Flat deposit (cents)", 2000, "2000 = $20.00. Used when the deposit is a flat amount; never more than the basket total.")),
              ],
            },
            {
              name: "allowPayInFull",
              type: "checkbox",
              defaultValue: true,
              label: "Let customers pay the full basket price up front",
            },
          ],
        },
      ],
    },
  ],
};

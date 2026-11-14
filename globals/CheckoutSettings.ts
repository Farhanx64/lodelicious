import type { Field, GlobalConfig } from "payload";

import { isCommerceManager, isStaff } from "../src/access/roles";
import { withCents } from "../src/fields/money";
import { percentToBasisPoints, SHIP_TAX_HELP } from "../src/lib/checkout/ship-tax";
import { US_STATES } from "../src/lib/shipping/rates";
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
  admin: { group: "Settings", description: "Default tax classes and tax by ship-to state, pickup times and closed dates, and the deposit for basket reservations." },
  access: { read: isStaff, update: isCommerceManager },
  hooks: {
    afterChange: [
      auditGlobal([
        "defaultTaxClass",
        "packagingTaxClass",
        "shipTaxStates",
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
            {
              // D65: shipped orders are taxed by the ship-to state. Pickup always uses the tax classes above.
              name: "shipTaxStates",
              label: "Tax by ship-to state",
              type: "array",
              labels: { singular: "State", plural: "States" },
              admin: {
                description: `${SHIP_TAX_HELP} Orders shipped to a state in this list pay its rate on taxable items; orders shipped to any other state pay no sales tax, and the Clover order is marked "no tax". Pickup always uses the tax classes above. Shipping is never taxed.`,
              },
              defaultValue: [{ state: "MA", ratePercent: 6.25, cloverTaxName: "Sales Tax" }],
              validate: (rows: unknown) => {
                const seen = new Set<string>();
                for (const row of Array.isArray(rows) ? (rows as { state?: string }[]) : []) {
                  if (row?.state && seen.has(row.state)) return `${row.state} is listed twice. Keep one row per state.`;
                  if (row?.state) seen.add(row.state);
                }
                return true;
              },
              fields: [
                {
                  type: "row",
                  fields: [
                    { name: "state", label: "State", type: "select", required: true, options: US_STATES.map((s) => ({ label: s, value: s })), admin: { width: "25%" } },
                    {
                      name: "ratePercent",
                      label: "Rate (%)",
                      type: "number",
                      required: true,
                      min: 0,
                      max: 100,
                      admin: { width: "25%", step: 0.01, description: "6.25 = 6.25%." },
                      validate: (v: unknown) => (percentToBasisPoints(v) === null ? "Enter a percentage with at most two decimals, e.g. 6.25" : true),
                    },
                    {
                      name: "cloverTaxName",
                      label: "Clover tax rate name",
                      type: "text",
                      maxLength: 60,
                      admin: { width: "50%", description: 'The name of this rate in Clover → Taxes & fees, exactly (Lody\'s is "Sales Tax"). Blank uses "Sales Tax".' },
                    },
                  ],
                },
              ],
            },
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

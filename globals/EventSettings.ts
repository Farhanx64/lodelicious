import type { Field, GlobalConfig } from "payload";

import { anyone, isCommerceManager } from "../src/access/roles";
import { auditGlobal } from "../src/hooks/audit";
import { DEFAULT_FOUNTAIN_TERMS, MAX_GUESTS } from "../src/lib/inquiries/estimate";

type Num = number | null | undefined;

/** A whole number within bounds (cents, hours, basis points or guests). `required` fields must be filled. */
const whole = (
  name: string,
  label: string,
  opts: { defaultValue?: number; min: number; max: number; required?: boolean; description: string },
): Field => ({
  name,
  label,
  type: "number",
  required: opts.required ?? false,
  min: opts.min,
  max: opts.max,
  ...(opts.defaultValue !== undefined ? { defaultValue: opts.defaultValue } : {}),
  admin: { description: opts.description, step: 1 },
  validate: (v: Num) => {
    if (v === null || v === undefined) return opts.required ? "Enter a whole number" : true;
    if (!Number.isSafeInteger(v)) return "Enter a whole number";
    return v >= opts.min && v <= opts.max ? true : `Enter a number from ${opts.min} to ${opts.max}`;
  },
});

const perGuestMatchesBreakdown = (v: Num, { siblingData }: { siblingData: Record<string, unknown> }) => {
  if (!Number.isSafeInteger(v)) return "Enter a whole number";
  if ((v as number) < 0 || (v as number) > 50_000) return "Enter a number from 0 to 50000";
  const chocolate = siblingData.chocolatePerGuestCents;
  const fruit = siblingData.fruitPerGuestCents;
  if (typeof chocolate === "number" && typeof fruit === "number" && chocolate + fruit !== v) {
    return `Chocolate (${chocolate}) + fruit (${fruit}) must add up to the per-guest price, or clear the breakdown`;
  }
  return true;
};

const d = DEFAULT_FOUNTAIN_TERMS;

/**
 * Chocolate fountain rental terms (D37). The prices are the offer Lody confirmed (PRD). The
 * terms below it are still unresolved with her: they stay empty, and customers see one only
 * once it has been filled in. Rentals are inquiry-only: no deposit is ever taken online.
 */
export const EventSettings: GlobalConfig = {
  slug: "event-settings",
  label: "Events (chocolate fountain)",
  admin: { group: "Settings" },
  access: { read: anyone, update: isCommerceManager },
  hooks: {
    afterChange: [
      auditGlobal([
        "enabled",
        "baseCents",
        "includedHours",
        "perGuestCents",
        "chocolatePerGuestCents",
        "fruitPerGuestCents",
        "depositPercentBasisPoints",
        "cancellationTerms",
        "serviceArea",
        "minimumGuests",
        "extensionTerms",
      ]),
    ],
  },
  fields: [
    {
      name: "enabled",
      label: "Take chocolate fountain inquiries on the website",
      type: "checkbox",
      defaultValue: true,
      admin: { description: "Untick to show \"not currently available, contact us\" on the Events page and stop new requests." },
    },
    {
      type: "row",
      fields: [
        whole("baseCents", "Base price (cents)", {
          defaultValue: d.baseCents,
          min: 0,
          max: 1_000_000,
          required: true,
          description: "25000 = $250.00, for the included hours with setup and service.",
        }),
        whole("includedHours", "Included hours", { defaultValue: d.includedHours, min: 1, max: 24, required: true, description: "Hours of service in the base price." }),
      ],
    },
    {
      name: "perGuestCents",
      label: "Per person (cents)",
      type: "number",
      required: true,
      min: 0,
      max: 50_000,
      defaultValue: d.perGuestCents,
      admin: { step: 1, description: "850 = $8.50 per person. The estimate is base + per person x guests." },
      validate: perGuestMatchesBreakdown,
    },
    {
      type: "row",
      fields: [
        whole("chocolatePerGuestCents", "Chocolate per person (cents)", {
          defaultValue: d.chocolatePerGuestCents ?? undefined,
          min: 0,
          max: 50_000,
          description: "Shown as a breakdown of the per-person price: 500 = $5.00.",
        }),
        whole("fruitPerGuestCents", "Fruit per person (cents)", {
          defaultValue: d.fruitPerGuestCents ?? undefined,
          min: 0,
          max: 50_000,
          description: "350 = $3.50. Chocolate + fruit must equal the per-person price, or leave both empty.",
        }),
      ],
    },
    whole("depositPercentBasisPoints", "Deposit (basis points)", {
      defaultValue: d.depositPercentBasisPoints,
      min: 0,
      max: 10_000,
      required: true,
      description:
        "2500 = 25%. Requested after staff confirm availability and the price, and never taken online. What the percentage applies to and when the balance is due are not decided yet.",
    }),
    {
      type: "collapsible",
      label: "Terms not decided yet",
      admin: {
        initCollapsed: false,
        description: "Customers see each of these on the Events page only once it is filled in. Leave a box empty until Lody has decided the term.",
      },
      fields: [
        {
          name: "cancellationTerms",
          label: "Cancellation wording",
          type: "textarea",
          maxLength: 1000,
          admin: { description: "The PRD calls \"free cancellation within one week\" ambiguous, so it is not published. Write the approved wording here." },
        },
        { name: "serviceArea", label: "Service area", type: "textarea", maxLength: 500 },
        whole("minimumGuests", "Minimum guests", { min: 1, max: MAX_GUESTS, description: "Shown as a requirement. The form still accepts smaller groups; staff decide." }),
        { name: "extensionTerms", label: "Extra hours and extensions", type: "textarea", maxLength: 1000 },
      ],
    },
  ],
};

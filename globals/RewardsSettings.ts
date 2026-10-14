import type { GlobalConfig } from "payload";

import { isCommerceManager, isStaff, ownerField } from "../src/access/roles";
import { auditGlobal } from "../src/hooks/audit";
import { guardRewardsSettings } from "../src/hooks/rewards";
import { DEFAULT_PROGRAM_NAME, MAX_POINTS_PER_DOLLAR } from "../src/lib/rewards/program";

/**
 * The rewards program (D45). Starts switched off with nothing filled in: the earn rate, the rewards
 * and the terms are Lody's decisions. The live site shows nothing about rewards until it is switched
 * on, complete and approved by the owner; staging shows it unapproved, marked as a draft.
 */
export const RewardsSettings: GlobalConfig = {
  slug: "rewards-settings",
  label: "Rewards program",
  admin: {
    group: "Rewards",
    description:
      "Members earn points on what they pay before tax and spend them on a fixed amount off a shop order. Changing the earn rate, rewards, welcome points or terms of an approved program needs the owner's approval again.",
  },
  access: { read: isStaff, update: isCommerceManager },
  hooks: {
    beforeChange: [guardRewardsSettings],
    afterChange: [auditGlobal(["enabled", "approved", "programName", "pointsPerDollar", "welcomePoints", "rewards", "terms"])],
  },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "enabled",
          label: "Switched on",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "Customers can join, sign in, earn and spend points. The live site also needs the owner's approval below." },
        },
        {
          name: "approved",
          label: "Approved by the owner",
          type: "checkbox",
          defaultValue: false,
          access: { update: ownerField },
          admin: { description: "Only the owner can tick this. Until then the program shows only on staging, marked as a draft." },
        },
      ],
    },
    { name: "programName", label: "Program name", type: "text", defaultValue: DEFAULT_PROGRAM_NAME, maxLength: 60 },
    {
      type: "row",
      fields: [
        {
          name: "pointsPerDollar",
          label: "Points per dollar",
          type: "number",
          min: 1,
          max: MAX_POINTS_PER_DOLLAR,
          admin: { step: 1, description: "Points for each whole dollar paid before tax, after any reward. Rounded down." },
        },
        { name: "welcomePoints", label: "Welcome points", type: "number", min: 0, defaultValue: 0, admin: { step: 1, description: "Points a new member starts with. 0 for none." } },
      ],
    },
    {
      name: "rewards",
      label: "Rewards",
      type: "array",
      labels: { singular: "Reward", plural: "Rewards" },
      admin: { description: "What points can be spent on: a fixed amount off a shop order, taken off before tax. One reward per order." },
      fields: [
        {
          type: "row",
          fields: [
            { name: "pointsRequired", label: "Points", type: "number", required: true, min: 1, admin: { step: 1 } },
            {
              name: "discountCents",
              label: "Amount off (cents)",
              type: "number",
              required: true,
              min: 1,
              admin: { step: 1, description: "In cents: 500 is $5.00.", components: { Cell: "@/components/admin/CentsCell#CentsCell" } },
            },
          ],
        },
      ],
    },
    {
      name: "terms",
      label: "Terms customers see",
      type: "textarea",
      admin: {
        rows: 10,
        description:
          "Shown on the rewards page and when joining. Say what points are worth, that they have no cash value, and anything about expiry or changes to the program. Paragraphs are separated by a blank line.",
      },
    },
  ],
};

import type { CollectionConfig } from "payload";

import { isCommerceManager, isStaff, nobody } from "../src/access/roles";
import { auditCollection } from "../src/hooks/audit";
import { applyPointsAdjustment } from "../src/hooks/rewards";

/**
 * How staff change a member's points (D45), the same way stock is adjusted (D40): add a row, and the
 * server changes the balance and writes the history entry in one atomic step. Rows can't be edited or
 * deleted afterwards. Owner and manager only.
 */
export const RewardAdjustments: CollectionConfig = {
  slug: "reward-adjustments",
  labels: { singular: "Points adjustment", plural: "Points adjustments" },
  admin: {
    useAsTitle: "note",
    group: "Rewards",
    defaultColumns: ["createdAt", "member", "points", "balanceAfter", "note", "user"],
    description: "Add or take away a member's points, for example a goodwill gesture or a purchase made in the shop. The balance can't go below zero.",
  },
  defaultSort: "-createdAt",
  access: { read: isStaff, create: isCommerceManager, update: nobody, delete: nobody },
  hooks: {
    beforeChange: [applyPointsAdjustment],
    afterChange: [auditCollection(["member", "points", "note"])],
  },
  fields: [
    { name: "member", type: "relationship", relationTo: "members", admin: { description: "Required." } },
    { name: "points", type: "number", required: true, admin: { step: 1, description: "Points to add (for example 50) or take away (for example -20)." } },
    { name: "note", type: "textarea", required: true, admin: { description: "Why. The member doesn't see this; staff do." } },
    { name: "balanceAfter", label: "Balance after", type: "number", admin: { readOnly: true, description: "Filled in automatically." } },
    { name: "user", label: "Staff member", type: "relationship", relationTo: "users", admin: { readOnly: true, position: "sidebar", description: "Filled in automatically." } },
    { name: "requestId", type: "text", admin: { readOnly: true, hidden: true } },
  ],
};

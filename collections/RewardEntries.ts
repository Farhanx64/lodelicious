import type { CollectionConfig } from "payload";

import { isStaff, nobody } from "../src/access/roles";
import { ENTRY_KINDS, ENTRY_LABELS } from "../src/lib/rewards/ledger";

/**
 * The points ledger (D47). Written only by `src/lib/rewards/ledger.ts`, in the same atomic step that
 * changes the member's balance; nobody can add, edit or delete a row here, so it is the full history
 * of every member's points.
 */
export const RewardEntries: CollectionConfig = {
  slug: "reward-entries",
  labels: { singular: "Points entry", plural: "Points history" },
  admin: {
    group: "Rewards",
    defaultColumns: ["createdAt", "member", "kind", "points", "balanceAfter", "reference", "note"],
    description: "Every change to every member's points. Read only: to change points, add a Points adjustment.",
  },
  defaultSort: "-createdAt",
  access: { read: isStaff, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: "member", type: "relationship", relationTo: "members", index: true, admin: { description: "Empty if the member was deleted." } },
    { name: "kind", type: "select", required: true, options: ENTRY_KINDS.map((value) => ({ label: ENTRY_LABELS[value], value })) },
    {
      type: "row",
      fields: [
        { name: "points", type: "number", required: true },
        { name: "balanceAfter", label: "Balance after", type: "number" },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "order", type: "relationship", relationTo: "orders" },
        { name: "reservation", type: "relationship", relationTo: "reservations" },
      ],
    },
    { name: "reference", type: "text" },
    { name: "user", label: "Staff member", type: "relationship", relationTo: "users" },
    { name: "note", type: "textarea" },
    { name: "idempotencyKey", type: "text", required: true, unique: true, index: true, admin: { hidden: true } },
  ],
};

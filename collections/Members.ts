import type { CollectionBeforeChangeHook, CollectionConfig, FieldAccess } from "payload";

import { isCommerceManager, isOwner, isStaff, nobody } from "../src/access/roles";
import { auditCollection, auditDelete } from "../src/hooks/audit";
import { normaliseEmail } from "../src/lib/rewards/credentials";
import { balanceOf } from "../src/lib/rewards/ledger";

/** Sign-in secrets: never readable or writable through the admin or the API, only by the member service. */
const secret: { read: FieldAccess; update: FieldAccess; create: FieldAccess } = { read: () => false, update: () => false, create: () => false };

/**
 * The balance is written only by the points ledger (D45), in the same atomic step as its entry. A
 * staff save carries the balance the form was opened with, so it is always replaced with the live
 * number, and a new member always starts at 0 (welcome points are a ledger entry).
 */
const pinBalance: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  if (operation === "create") return { ...data, pointsBalance: 0 };
  const id = Number(originalDoc?.id);
  const next: Record<string, unknown> = { ...data, pointsBalance: Number.isSafeInteger(id) ? await balanceOf(req.payload, id) : originalDoc?.pointsBalance };
  if (typeof data.email === "string") next.email = normaliseEmail(data.email);
  // Closing an account signs it out everywhere.
  if (data.status === "closed" && originalDoc?.status !== "closed") next.sessionVersion = Number(originalDoc?.sessionVersion ?? 0) + 1;
  return next;
};

/**
 * Rewards members (D45): customers who made an account to earn and spend points. Separate from
 * staff `users`, and not a Payload auth collection, so a member can never reach the admin or the API.
 * Members join on the storefront; staff can correct contact details or close an account here, and
 * change points under Rewards → Points adjustments.
 */
export const Members: CollectionConfig = {
  slug: "members",
  labels: { singular: "Member", plural: "Members" },
  admin: {
    useAsTitle: "email",
    group: "Rewards",
    defaultColumns: ["name", "email", "phone", "pointsBalance", "status", "createdAt"],
    listSearchableFields: ["name", "email", "phone"],
    description: "Rewards members. Points change only through Points adjustments and checkout, so every change has a record.",
  },
  defaultSort: "-createdAt",
  access: { read: isStaff, create: nobody, update: isCommerceManager, delete: isOwner },
  hooks: {
    beforeChange: [pinBalance],
    afterChange: [auditCollection(["name", "email", "phone", "status"])],
    afterDelete: [auditDelete(["name", "email", "status", "pointsBalance"])],
  },
  fields: [
    {
      type: "row",
      fields: [
        { name: "name", type: "text", required: true, maxLength: 100 },
        { name: "email", type: "email", required: true, unique: true, index: true },
        { name: "phone", type: "text", maxLength: 30 },
      ],
    },
    {
      name: "pointsBalance",
      label: "Points",
      type: "number",
      defaultValue: 0,
      admin: { readOnly: true, position: "sidebar", description: "Live balance. Change it under Rewards → Points adjustments." },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Closed (can't sign in, earn or spend)", value: "closed" },
      ],
      admin: { position: "sidebar", description: "Closing signs the member out everywhere. Their points history is kept." },
    },
    { name: "termsAcceptedAt", label: "Accepted the terms", type: "date", access: { update: () => false }, admin: { readOnly: true, position: "sidebar", date: { pickerAppearance: "dayAndTime" } } },
    { name: "lastSignInAt", label: "Last signed in", type: "date", access: { update: () => false }, admin: { readOnly: true, position: "sidebar", date: { pickerAppearance: "dayAndTime" } } },
    { name: "passwordHash", type: "text", access: secret, admin: { hidden: true } },
    { name: "sessionVersion", type: "number", defaultValue: 0, access: secret, admin: { hidden: true } },
    { name: "failedSignIns", type: "number", defaultValue: 0, access: secret, admin: { hidden: true } },
    { name: "lockedUntil", type: "date", access: secret, admin: { hidden: true } },
    { name: "resetTokenHash", type: "text", index: true, access: secret, admin: { hidden: true } },
    { name: "resetExpiresAt", type: "date", access: secret, admin: { hidden: true } },
  ],
};

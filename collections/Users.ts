import type { CollectionBeforeChangeHook, CollectionConfig } from "payload";

import { ROLES, canManageCommerce, hasRole, isOwner, isStaff, ownerField } from "../src/access/roles";
import { auditCollection } from "../src/hooks/audit";

/**
 * The very first account becomes the owner, whatever roles were submitted. Payload's
 * create-first-user screen bypasses access control, so without this the first account would
 * get the default "fulfillment" role and nobody could administer the store.
 */
const firstUserIsOwner: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== "create") return data;
  const { totalDocs } = await req.payload.count({ collection: "users", overrideAccess: true, req });
  return totalDocs === 0 ? { ...data, roles: ["owner"] } : data;
};

export const Users: CollectionConfig = {
  slug: "users",
  admin: {
    useAsTitle: "email",
    defaultColumns: ["name", "email", "roles"],
    group: "Staff",
  },
  auth: true,
  access: {
    admin: isStaff,
    create: isOwner,
    delete: isOwner,
    read: ({ req }) => {
      if (canManageCommerce(req.user)) return true;
      return req.user ? { id: { equals: req.user.id } } : false;
    },
    update: ({ req }) => {
      if (hasRole(req.user, "owner")) return true;
      return req.user ? { id: { equals: req.user.id } } : false;
    },
  },
  hooks: {
    beforeChange: [firstUserIsOwner],
    afterChange: [auditCollection(["roles", "email"])],
  },
  fields: [
    {
      name: "name",
      type: "text",
    },
    {
      name: "roles",
      type: "select",
      hasMany: true,
      required: true,
      saveToJWT: true,
      defaultValue: ["fulfillment"],
      options: [
        { label: "Owner (full administration)", value: "owner" },
        { label: "Manager (orders, prices, refunds)", value: "manager" },
        { label: "Fulfillment (orders and assembly only)", value: "fulfillment" },
      ] satisfies { label: string; value: (typeof ROLES)[number] }[],
      access: {
        update: ownerField,
      },
      admin: {
        description: "Only the owner can change roles. Prices and refunds are limited to owner and manager.",
      },
    },
  ],
};

import type { CollectionConfig } from "payload";

import { isCommerceManager, nobody } from "../src/access/roles";

/**
 * Append-only record of commercial and settings changes (PRD OPS 03). Written only by hooks via
 * the Local API; nobody can create, edit or delete entries through the admin or REST API.
 */
export const AuditLog: CollectionConfig = {
  slug: "audit-log",
  labels: { singular: "Audit entry", plural: "Audit log" },
  admin: {
    useAsTitle: "target",
    defaultColumns: ["createdAt", "user", "action", "target", "targetId"],
    group: "Staff",
  },
  access: {
    read: isCommerceManager,
    create: nobody,
    update: nobody,
    delete: nobody,
  },
  fields: [
    { name: "action", type: "select", required: true, options: ["create", "update", "delete"] },
    { name: "target", type: "text", required: true, index: true },
    { name: "targetId", type: "text", required: true, index: true },
    { name: "user", type: "relationship", relationTo: "users" },
    { name: "changes", type: "json", required: true },
  ],
};

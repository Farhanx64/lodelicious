import type { CollectionConfig } from "payload";

import { isCommerceManager, nobody } from "../src/access/roles";

/**
 * One row per restartable background job (catalog import, Clover stock sync). Holds the
 * no-overlap lock and the checkpoint so a job killed by the host resumes where it stopped
 * (PRD INF 03/04). Managed by code only; visible to Lody and Faisal for monitoring.
 */
export const SyncJobs: CollectionConfig = {
  slug: "sync-jobs",
  labels: { singular: "Sync job", plural: "Sync jobs" },
  admin: {
    useAsTitle: "key",
    defaultColumns: ["key", "status", "lastSuccessAt", "attempts"],
    group: "Operations",
  },
  access: {
    read: isCommerceManager,
    create: nobody,
    update: nobody,
    delete: nobody,
  },
  fields: [
    { name: "key", type: "text", required: true, unique: true, index: true },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "idle",
      options: ["idle", "running", "failed"],
    },
    { name: "lockToken", type: "text", admin: { readOnly: true } },
    { name: "lockedUntil", type: "date", admin: { readOnly: true } },
    { name: "checkpoint", type: "json" },
    { name: "lastSuccessAt", type: "date" },
    { name: "lastError", type: "textarea" },
    { name: "attempts", type: "number", defaultValue: 0, min: 0 },
  ],
};

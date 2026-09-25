import type { CollectionBeforeChangeHook, CollectionConfig, FieldAccess } from "payload";

import { isCommerceManager, isStaff, nobody } from "../src/access/roles";
import { auditCollection } from "../src/hooks/audit";

export const SOURCES = [
  { label: "Clover (public storefront)", value: "clover_public" },
  { label: "Clover (authorized export)", value: "clover_export" },
  { label: "Owner price-list screenshot", value: "price_list_screenshot" },
  { label: "DoorDash (channel price)", value: "doordash" },
] as const;

export const DISPOSITIONS = [
  { label: "Unreviewed", value: "unreviewed" },
  { label: "Active online", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Confirmed duplicate", value: "duplicate" },
  { label: "In-store only", value: "in_store_only" },
  { label: "Owner-approved exclusion", value: "excluded" },
] as const;

/** Source evidence is immutable once imported; only review fields change. */
const immutable: FieldAccess = () => false;

const stampReview: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  const changed =
    operation === "update" &&
    (data.disposition !== originalDoc?.disposition || data.duplicateOf !== originalDoc?.duplicateOf);
  if (!changed) return data;
  return { ...data, reviewedBy: req.user?.id ?? null, reviewedAt: new Date().toISOString() };
};

/**
 * Every observed product record from Clover, the price screenshot and DoorDash (PRD CAT 01–03).
 * These are evidence for reconciliation, never sellable products: a source price is not an
 * approved website price.
 */
export const SourceRecords: CollectionConfig = {
  slug: "source-records",
  labels: { singular: "Source record", plural: "Source records" },
  admin: {
    useAsTitle: "sourceName",
    defaultColumns: ["ref", "sourceName", "source", "sourcePriceCents", "disposition"],
    group: "Catalog",
    description:
      "Observed products from Clover, the price list and DoorDash. Review each one; source prices are not website prices.",
  },
  access: {
    read: isStaff,
    create: nobody,
    update: isCommerceManager,
    delete: nobody,
  },
  hooks: {
    beforeChange: [stampReview],
    afterChange: [auditCollection(["disposition", "duplicateOf", "reviewNotes"])],
  },
  fields: [
    {
      type: "row",
      fields: [
        { name: "ref", type: "text", required: true, unique: true, index: true, access: { update: immutable } },
        { name: "source", type: "select", required: true, index: true, options: [...SOURCES], access: { update: immutable } },
      ],
    },
    { name: "sourceName", type: "text", required: true, access: { update: immutable } },
    { name: "sourceBrand", type: "text", access: { update: immutable } },
    {
      name: "sourcePriceCents",
      type: "number",
      required: true,
      min: 0,
      access: { update: immutable },
      admin: { description: "Observed price in cents (e.g. 1295 = $12.95). Evidence only." },
    },
    { name: "cloverId", type: "text", index: true, access: { update: immutable } },
    { name: "observedOn", type: "date", access: { update: immutable } },
    { name: "sourceNotes", type: "textarea", access: { update: immutable } },
    {
      type: "collapsible",
      label: "Review",
      fields: [
        { name: "disposition", type: "select", required: true, defaultValue: "unreviewed", index: true, options: [...DISPOSITIONS] },
        {
          name: "duplicateOf",
          type: "relationship",
          relationTo: "source-records",
          admin: { condition: (_data, sibling) => sibling?.disposition === "duplicate" },
        },
        { name: "reviewNotes", type: "textarea" },
        { name: "reviewedBy", type: "relationship", relationTo: "users", admin: { readOnly: true } },
        { name: "reviewedAt", type: "date", admin: { readOnly: true } },
      ],
    },
  ],
};

import type { CollectionConfig, Field } from "payload";

import { isCommerceManager } from "../src/access/roles";
import { auditCollection } from "../src/hooks/audit";
import { slugField } from "../src/fields/slug";
import { GIFT_TYPES, SPECIAL_CODES } from "../src/lib/gifts/types";

const cents = (name: string, label: string, description?: string): Field => ({
  name,
  label,
  type: "number",
  min: 0,
  admin: {
    step: 1,
    description: description ?? "In cents: 1295 = $12.95",
    components: { Cell: "@/components/admin/CentsCell#CentsCell" },
  },
  validate: (value: number | null | undefined) =>
    value === null || value === undefined || Number.isSafeInteger(value) ? true : "Enter whole cents (1295 for $12.95)",
});

const whole = (name: string, label: string, defaultValue?: number, description?: string): Field => ({
  name,
  label,
  type: "number",
  min: 0,
  ...(defaultValue !== undefined ? { defaultValue } : {}),
  admin: { step: 1, ...(description ? { description } : {}) },
  validate: (value: number | null | undefined) =>
    value === null || value === undefined || Number.isSafeInteger(value) ? true : "Enter a whole number",
});

/**
 * Everything sold or used in gifts. Lody and Faisal add, edit, publish, unpublish and delete
 * products in /admin; fulfillment staff can view but not change them. Drafts keep unfinished
 * products off the storefront, and version history keeps every earlier state.
 */
export const Products: CollectionConfig = {
  slug: "products",
  labels: { singular: "Product", plural: "Products" },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "category", "priceCents", "stockState", "stockQuantity", "_status"],
    group: "Catalog",
    listSearchableFields: ["title", "brand", "sku"],
  },
  versions: { drafts: true, maxPerDoc: 25 },
  access: {
    read: ({ req }) => (req.user ? true : { _status: { equals: "published" } }),
    create: isCommerceManager,
    update: isCommerceManager,
    delete: isCommerceManager,
  },
  hooks: {
    afterChange: [
      auditCollection([
        "title",
        "priceCents",
        "priceApproved",
        "channel",
        "stockState",
        "stockQuantity",
        "variants",
        "premium",
        "giftTypes",
        "basketEligible",
        "_status",
      ]),
    ],
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Details",
          fields: [
            { name: "title", type: "text", required: true },
            {
              type: "row",
              fields: [
                { name: "category", type: "relationship", relationTo: "categories", required: true },
                { name: "brand", type: "text", admin: { description: "Supplier brand as printed, e.g. Phillips Chocolates." } },
                { name: "sizeLabel", label: "Size / pack", type: "text", admin: { description: "e.g. 7 oz, 9 pieces" } },
              ],
            },
            { name: "shortDescription", type: "textarea", admin: { description: "One or two sentences for product cards." } },
            { name: "description", type: "textarea" },
            {
              name: "images",
              type: "array",
              labels: { singular: "Image", plural: "Images" },
              admin: { description: "The first image is the main photo." },
              fields: [{ name: "image", type: "upload", relationTo: "media", required: true }],
            },
            { name: "featured", type: "checkbox", defaultValue: false, admin: { description: "Show on the home page." } },
          ],
        },
        {
          label: "Price",
          fields: [
            cents("priceCents", "Price"),
            {
              name: "priceApproved",
              type: "checkbox",
              defaultValue: false,
              admin: { description: "Only approved prices can be bought. Source-observed prices start unapproved." },
            },
            { name: "priceSource", type: "text", admin: { description: "Where the price came from, e.g. owner product card 2026-09-26." } },
          ],
        },
        {
          label: "Availability & stock",
          fields: [
            {
              name: "channel",
              type: "select",
              required: true,
              defaultValue: "online",
              options: [
                { label: "Sold online", value: "online" },
                { label: "In store only (visible, not purchasable online)", value: "in_store_only" },
                { label: "Inquiry only", value: "inquiry_only" },
                { label: "Hidden", value: "hidden" },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "stockState",
                  type: "select",
                  required: true,
                  defaultValue: "unknown",
                  options: [
                    { label: "Counted", value: "known" },
                    { label: "Unknown — not purchasable", value: "unknown" },
                  ],
                },
                whole("stockQuantity", "Quantity on hand"),
                whole("lowStockThreshold", "Low-stock label at or below", 3),
              ],
            },
            { name: "stockCountedAt", type: "date", admin: { description: "When stock was last counted against the shelf/Clover." } },
            {
              name: "variants",
              type: "array",
              labels: { singular: "Option", plural: "Options" },
              admin: {
                description:
                  "Colours or styles sold separately (e.g. pink / blue, window / classic box). Each option has its own stock and may override the price.",
              },
              fields: [
                {
                  type: "row",
                  fields: [
                    { name: "key", type: "text", required: true, admin: { description: "Short code, e.g. pink" } },
                    { name: "label", type: "text", required: true },
                    cents("priceCents", "Price override", "Leave empty to use the product price."),
                  ],
                },
                {
                  type: "row",
                  fields: [
                    {
                      name: "stockState",
                      type: "select",
                      required: true,
                      defaultValue: "unknown",
                      options: [
                        { label: "Counted", value: "known" },
                        { label: "Unknown", value: "unknown" },
                      ],
                    },
                    whole("stockQuantity", "Quantity on hand"),
                    { name: "image", type: "upload", relationTo: "media" },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: "Gift builder",
          fields: [
            { name: "basketEligible", type: "checkbox", defaultValue: false, label: "Can be chosen inside a custom gift" },
            {
              name: "giftTypes",
              type: "select",
              hasMany: true,
              options: [
                { label: "Sweet", value: "sweet" },
                { label: "Savory", value: "savory" },
                { label: "Sweet & savory", value: "sweet_savory" },
                { label: "Sympathy", value: "sympathy" },
              ] satisfies { label: string; value: (typeof GIFT_TYPES)[number] }[],
            },
            {
              name: "premium",
              type: "checkbox",
              defaultValue: false,
              admin: {
                description:
                  "Only for verified Phillips Chocolate, Cape Cod Fudge, OMNIYA Delicacy or Swiss Chocolate products. Counts toward the premium limit.",
              },
            },
            {
              type: "row",
              fields: [
                whole("maxPerGift", "Max per gift", 1, "1 unless sold in multiples or assortments."),
                whole("fitUnits", "Fit units", 1, "Space it takes in a basket; 1 until measured."),
                {
                  name: "exclusiveTo",
                  type: "select",
                  options: SPECIAL_CODES.map((value) => ({ label: value.replace(/_/g, " "), value })),
                  admin: { description: "Only included with this presentation (e.g. the baby blanket)." },
                },
              ],
            },
            { name: "assemblyNotes", type: "textarea", admin: { description: "Staff-only notes for packing." } },
          ],
        },
        {
          label: "Allergens & dietary",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "nutFree",
                  type: "select",
                  required: true,
                  defaultValue: "unknown",
                  options: [
                    { label: "Unknown", value: "unknown" },
                    { label: "Yes", value: "yes" },
                    { label: "No", value: "no" },
                    { label: "Not guaranteed", value: "not_guaranteed" },
                  ],
                },
                {
                  name: "vegan",
                  type: "select",
                  required: true,
                  defaultValue: "unknown",
                  options: [
                    { label: "Unknown", value: "unknown" },
                    { label: "Yes", value: "yes" },
                    { label: "No", value: "no" },
                  ],
                },
              ],
            },
            { name: "allergenNotes", type: "textarea" },
            {
              name: "dietarySource",
              type: "text",
              admin: { description: "Where this information came from. Never infer allergens from a product name." },
            },
          ],
        },
        {
          label: "Fulfillment",
          fields: [
            {
              type: "row",
              fields: [
                { name: "pickup", type: "checkbox", defaultValue: true, label: "Pickup" },
                { name: "localDelivery", type: "checkbox", defaultValue: true, label: "Local delivery" },
                { name: "shippable", type: "checkbox", defaultValue: false, label: "Can ship" },
                { name: "perishable", type: "checkbox", defaultValue: false, label: "Perishable / prepared" },
              ],
            },
            whole("packedWeightOz", "Packed weight (oz)"),
          ],
        },
        {
          label: "Records",
          fields: [
            {
              type: "row",
              fields: [
                { name: "sku", type: "text", unique: true, index: true },
                { name: "cloverId", type: "text", index: true },
              ],
            },
            {
              name: "sourceRecords",
              type: "relationship",
              relationTo: "source-records",
              hasMany: true,
              admin: { description: "The observed source rows this product was reconciled from." },
            },
          ],
        },
      ],
    },
    slugField("title"),
  ],
};

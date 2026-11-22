import type { CollectionBeforeChangeHook, CollectionConfig } from "payload";

import { isStaff } from "../src/access/roles";
import { auditCollection, auditDelete } from "../src/hooks/audit";
import { REVIEW_LIMITS, REVIEW_STATUSES } from "../src/lib/reviews/product-reviews";

/** Records when a review was approved, and clears it if it is taken down again. */
const stampApproval: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  if (data.status === "approved") data.approvedAt = originalDoc?.status === "approved" && originalDoc.approvedAt ? originalDoc.approvedAt : new Date().toISOString();
  else if (data.status) data.approvedAt = null;
  return data;
};

/**
 * Reviews customers send from product pages (D69). Every one arrives as Waiting for approval and
 * shows on the website only after staff set it to Approved. Staff never write reviews here:
 * reviews must come from customers. The shop's Google reviews are the separate Reviews collection (D52).
 */
export const ProductReviews: CollectionConfig = {
  slug: "product-reviews",
  labels: { singular: "Product review", plural: "Product reviews" },
  admin: {
    useAsTitle: "name",
    group: "Website",
    description:
      "Reviews customers send from product pages. Nothing shows on the website until you set it to Approved. Reject spam, abuse or anything that isn't about the product; don't edit what a customer wrote. The email is private and only for asking the customer about their review.",
    defaultColumns: ["name", "product", "rating", "status", "createdAt"],
    listSearchableFields: ["name", "text"],
  },
  defaultSort: "-createdAt",
  // Staff only over the API: the product page reads approved reviews itself, and the review form saves through the server (rate limited).
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  hooks: {
    beforeChange: [stampApproval],
    afterChange: [auditCollection(["status", "rating", "product"])],
    afterDelete: [auditDelete(["status", "rating", "product"])],
  },
  fields: [
    { name: "product", type: "relationship", relationTo: "products", required: true, index: true },
    {
      type: "row",
      fields: [
        { name: "name", label: "Customer's name", type: "text", required: true, maxLength: REVIEW_LIMITS.name },
        {
          name: "rating",
          label: "Stars",
          type: "number",
          required: true,
          min: 1,
          max: 5,
          admin: { step: 1 },
          validate: (value: number | null | undefined) => (Number.isInteger(value) && value! >= 1 && value! <= 5 ? true : "A whole number from 1 to 5"),
        },
      ],
    },
    { name: "text", label: "Review", type: "textarea", required: true, maxLength: REVIEW_LIMITS.text },
    { name: "email", label: "Customer's email (private)", type: "email", admin: { description: "Never shown on the website." } },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      index: true,
      options: [
        { label: "Waiting for approval", value: "pending" },
        { label: "Approved (shown on the product page)", value: "approved" },
        { label: "Rejected", value: "rejected" },
      ] satisfies { label: string; value: (typeof REVIEW_STATUSES)[number] }[],
      admin: { position: "sidebar" },
    },
    { name: "approvedAt", label: "Approved on", type: "date", admin: { position: "sidebar", readOnly: true, date: { pickerAppearance: "dayAndTime" } } },
  ],
};

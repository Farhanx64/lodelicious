import type { CollectionConfig } from "payload";

import { anyone, isStaff } from "../src/access/roles";
import { auditCollection, auditDelete } from "../src/hooks/audit";
import { MAX_REVIEW_NAME_LENGTH, MAX_REVIEW_TEXT_LENGTH } from "../src/lib/reviews/shared";

/**
 * Google reviews Lody chooses to show on the home page (D52). Staff copy them in by hand from the
 * shop's Google listing; customers cannot post reviews on the website, and nothing is fetched from
 * Google. Every review here is public: the home page carousel shows them all, featured first.
 */
export const Reviews: CollectionConfig = {
  slug: "reviews",
  labels: { singular: "Review", plural: "Reviews" },
  admin: {
    useAsTitle: "name",
    group: "Website",
    description:
      "Google reviews shown in the carousel on the home page, featured ones first, then the newest. Copy a review in from Google; delete it here to take it off the website. Under Store details, add the Google review link to show a “Leave us a review on Google” button.",
    defaultColumns: ["name", "rating", "date", "featured"],
    listSearchableFields: ["name", "text"],
  },
  defaultSort: "-date",
  // Anyone may read (they are on the home page); only staff add, change or remove them.
  access: { read: anyone, create: isStaff, update: isStaff, delete: isStaff },
  hooks: { afterChange: [auditCollection(["name", "rating", "featured"])], afterDelete: [auditDelete(["name", "rating"])] },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "name",
          label: "Reviewer",
          type: "text",
          required: true,
          maxLength: MAX_REVIEW_NAME_LENGTH,
          admin: { description: "First name or initials only, e.g. “Maria” or “J. P.”" },
        },
        {
          name: "rating",
          label: "Stars",
          type: "number",
          required: true,
          min: 1,
          max: 5,
          defaultValue: 5,
          admin: { step: 1 },
          validate: (value: number | null | undefined) => (Number.isInteger(value) && value! >= 1 && value! <= 5 ? true : "A whole number from 1 to 5"),
        },
        {
          name: "date",
          label: "Date of the review",
          type: "date",
          admin: { date: { pickerAppearance: "monthOnly", displayFormat: "MMMM yyyy" }, description: "Shown as month and year." },
        },
      ],
    },
    { name: "text", label: "Review", type: "textarea", required: true, maxLength: MAX_REVIEW_TEXT_LENGTH },
    {
      name: "featured",
      type: "checkbox",
      defaultValue: false,
      admin: { position: "sidebar", description: "Featured reviews come first in the carousel." },
    },
  ],
};

import type { CollectionConfig } from "payload";

import { isCommerceManager, isStaff } from "../src/access/roles";
import { auditCollection, auditDelete } from "../src/hooks/audit";
import { slugField } from "../src/fields/slug";

/** Shop categories. Fully managed in /admin: add, rename, reorder, hide or delete. */
export const Categories: CollectionConfig = {
  slug: "categories",
  labels: { singular: "Category", plural: "Categories" },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "slug", "sortOrder", "showInShop"],
    group: "Catalog",
  },
  defaultSort: "sortOrder",
  access: {
    // Staff only (A04, D42): categories not shown in the shop (and their descriptions) are not public. Storefront reads state their own `where`.
    read: isStaff,
    create: isCommerceManager,
    update: isCommerceManager,
    delete: isCommerceManager,
  },
  hooks: {
    afterChange: [auditCollection(["name", "slug", "showInShop"])],
    afterDelete: [auditDelete(["name", "slug", "showInShop"])],
  },
  fields: [
    { name: "name", type: "text", required: true },
    slugField("name"),
    { name: "description", type: "textarea" },
    { name: "image", type: "upload", relationTo: "media" },
    {
      type: "row",
      fields: [
        { name: "sortOrder", type: "number", defaultValue: 100, admin: { description: "Lower numbers appear first." } },
        { name: "showInShop", type: "checkbox", defaultValue: true, label: "Show as a filter in the shop" },
      ],
    },
  ],
};

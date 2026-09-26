import { fileURLToPath } from "url";
import path from "path";

import type { CollectionConfig } from "payload";

import { anyone, isCommerceManager } from "../src/access/roles";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// Uploads live in a private, persistent dir (outside public_html on the host).
// Set MEDIA_DIR to an absolute path on cPanel; locally defaults to ./.data/media.
const mediaDir = process.env.MEDIA_DIR
  ? path.resolve(process.env.MEDIA_DIR)
  : process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR, "media")
    : path.resolve(dirname, "..", ".data", "media");

export const Media: CollectionConfig = {
  slug: "media",
  admin: {
    group: "Catalog",
  },
  access: {
    read: anyone,
    create: isCommerceManager,
    update: isCommerceManager,
    delete: isCommerceManager,
  },
  upload: {
    staticDir: mediaDir,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    imageSizes: [
      { name: "thumb", width: 320 },
      { name: "card", width: 720 },
      { name: "large", width: 1440 },
    ],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
      admin: {
        description: "Describe what the photo shows for customers using screen readers.",
      },
    },
    {
      name: "sourceFile",
      type: "text",
      index: true,
      admin: { readOnly: true, position: "sidebar", description: "Set by the catalog seed; prevents duplicate uploads." },
    },
    {
      name: "credit",
      type: "text",
      admin: { description: "Who made the photo, e.g. \"Lodelicious\" or \"Supplier catalog image\"." },
    },
    {
      name: "approvedForLaunch",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description:
          "Tick only for owner-approved photos of the actual product. Staging placeholders stay unticked.",
      },
    },
  ],
};

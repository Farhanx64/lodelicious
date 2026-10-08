import { fileURLToPath } from "url";
import path from "path";

import { APIError, type Access, type CollectionBeforeOperationHook, type CollectionConfig } from "payload";

import { isCommerceManager, isStaff } from "../src/access/roles";
import { auditCollection, auditDelete } from "../src/hooks/audit";
import { isProductionEnv } from "../src/lib/app-env";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// Uploads live in a private, persistent dir (outside public_html on the host).
// Set MEDIA_DIR to an absolute path on cPanel; locally defaults to ./.data/media.
const mediaDir = process.env.MEDIA_DIR
  ? path.resolve(process.env.MEDIA_DIR)
  : process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR, "media")
    : path.resolve(dirname, "..", ".data", "media");

/**
 * Anonymous visitors may read only photos approved for launch on the live store (audit A10, D20,
 * D32). The storefront already hides unapproved photos in the page; this closes the file and REST
 * routes too, so the mood-board placeholders and supplier photos whose publishing rights are
 * unconfirmed cannot be listed or fetched. "Live" follows the APP_ENV allowlist (unset counts as
 * live). Staff of every role keep full access, and local, staging and test are unchanged. Payload
 * applies a query result to the resized files as well as the original, and to related photos
 * shown on products (they come back unpopulated, which the storefront renders as "Photo coming
 * soon"). Read at request time.
 */
export const mediaRead: Access = ({ req }) => {
  if (isStaff({ req })) return true;
  return isProductionEnv() ? { approvedForLaunch: { equals: true } } : true;
};

/** Largest photo the admin accepts. Phone and camera photos are well under this; sharp makes three sizes of each upload. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** Stops an oversized file before Payload decodes and resizes it (audit A23). Payload's own parser limit is 20 MB. */
const limitUploadSize: CollectionBeforeOperationHook = ({ args, req }) => {
  const size = req.file?.size;
  if (typeof size === "number" && size > MAX_UPLOAD_BYTES) {
    const megabytes = Math.max(1, Math.round(size / (1024 * 1024)));
    throw new APIError(`That photo is ${megabytes} MB. Please use one under ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`, 413, null, true);
  }
  return args;
};

export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "Photo", plural: "Photos" },
  admin: {
    group: "Website",
    description: "Every photo used on the website: products, categories, the home page and gift presentations. The live site shows only photos ticked Approved for launch.",
    defaultColumns: ["filename", "alt", "approvedForLaunch", "credit", "updatedAt"],
  },
  access: {
    read: mediaRead,
    create: isCommerceManager,
    update: isCommerceManager,
    delete: isCommerceManager,
  },
  hooks: {
    beforeOperation: [limitUploadSize],
    afterChange: [auditCollection(["approvedForLaunch", "filename"])],
    afterDelete: [auditDelete(["approvedForLaunch", "filename"])],
  },
  upload: {
    staticDir: mediaDir,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    // Refuse to decode an image bigger than 64 megapixels (a 61 MP camera is 9504 x 6336); sharp's default allows 268 MP.
    constructorOptions: { limitInputPixels: 64_000_000 },
    imageSizes: [
      { name: "thumb", width: 320 },
      { name: "card", width: 720 },
      { name: "large", width: 1440 },
    ],
  },
  fields: [
    {
      name: "alt",
      label: "Alt text",
      type: "text",
      required: true,
      admin: {
        description: "Describe what the photo shows for customers using screen readers.",
      },
    },
    {
      name: "sourceFile",
      label: "Source file",
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
      label: "Approved for launch",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description:
          "Tick only for owner-approved photos of the actual product. Staging placeholders stay unticked.",
      },
    },
  ],
};

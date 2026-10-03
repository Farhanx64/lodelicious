import type { GlobalConfig } from "payload";

import { anyone, isCommerceManager } from "../src/access/roles";
import { auditGlobal } from "../src/hooks/audit";

/**
 * Home-page photos laid out like Lody's mood board (D31). Only real photos of her shop and
 * products belong here; empty slots show branded placeholder panels.
 */
export const HomePage: GlobalConfig = {
  slug: "home-page",
  label: "Home page",
  admin: { group: "Settings" },
  access: { read: anyone, update: isCommerceManager },
  hooks: { afterChange: [auditGlobal(["heroImage", "stripImages"])] },
  fields: [
    {
      name: "heroImage",
      label: "Top photo",
      type: "upload",
      relationTo: "media",
      admin: {
        description:
          "Optional large photo at the top of the home page, e.g. your shop front. Leave empty to show the drawn awning with the logo.",
      },
    },
    {
      name: "stripImages",
      label: "Photo strip",
      type: "array",
      maxRows: 5,
      labels: { singular: "Photo", plural: "Photos" },
      admin: {
        description:
          "Up to five photos in the strip across the home page, left to right (flowers, gift boxes, ribbon, treats…). Use your own photos only. Empty spots show a soft colour panel with the gold bow.",
      },
      fields: [{ name: "image", type: "upload", relationTo: "media", required: true }],
    },
  ],
};

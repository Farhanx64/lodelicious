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
  hooks: { afterChange: [auditGlobal(["heroImage", "featureImages", "stripImages"])] },
  fields: [
    {
      name: "heroImage",
      label: "Top photo",
      type: "upload",
      relationTo: "media",
      admin: {
        description:
          "The large photo at the top of the home page (the board's awning). The starting picture is a mood-board placeholder: replace it with your own photo. Empty shows a drawn awning.",
      },
    },
    {
      name: "featureImages",
      label: "Photos beside the logo",
      type: "array",
      maxRows: 4,
      labels: { singular: "Photo", plural: "Photos" },
      admin: { description: "Up to four photos next to the logo panel, left to right. Replace the mood-board placeholders with your own." },
      fields: [{ name: "image", type: "upload", relationTo: "media", required: true }],
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

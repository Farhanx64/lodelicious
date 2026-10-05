import type { CollectionConfig } from "payload";

import { nobody } from "../src/access/roles";

/**
 * Shopping bags (D35). Server-only: the browser holds an opaque token in an httpOnly cookie and
 * every price is re-read at display and checkout, so nothing here is trusted as a price.
 */
export const Carts: CollectionConfig = {
  slug: "carts",
  admin: { hidden: true },
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: "tokenHash", type: "text", required: true, unique: true, index: true },
    {
      name: "lines",
      type: "array",
      maxRows: 50,
      fields: [
        { name: "unitId", type: "text", required: true },
        { name: "quantity", type: "number", required: true, min: 1, max: 20 },
      ],
    },
  ],
};

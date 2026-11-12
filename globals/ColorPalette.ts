import type { GlobalConfig } from "payload";

import { isCommerceManager, isStaff } from "../src/access/roles";
import { auditGlobal } from "../src/hooks/audit";
import { normalizeSavedColors, validateSavedColors } from "../src/lib/color-palette";

/**
 * The colours staff save with "+ Add" in the colour picker on Store details (D55). Stored on the
 * server rather than in the browser so the same swatches show on every device. Edited only through
 * the picker, so it is hidden from the admin menu.
 */
export const ColorPalette: GlobalConfig = {
  slug: "color-palette",
  label: "Saved colours",
  admin: { group: "Website", hidden: true },
  access: { read: isStaff, update: isCommerceManager },
  hooks: {
    beforeChange: [({ data }) => ({ ...data, colors: normalizeSavedColors(data.colors) })],
    afterChange: [auditGlobal(["colors"])],
  },
  fields: [
    {
      name: "colors",
      label: "Saved colours",
      type: "json",
      defaultValue: [],
      validate: validateSavedColors,
    },
  ],
};

import type { Field, GlobalConfig } from "payload";

import { isCommerceManager, isStaff } from "../src/access/roles";
import { auditGlobal } from "../src/hooks/audit";
import { DEFAULT_HOLD_MINUTES } from "../src/lib/inventory/types";

const whole = (name: string, label: string, description: string, extra: Record<string, unknown> = {}): Field =>
  ({
    name,
    label,
    type: "number",
    min: 1,
    admin: { description, step: 1 },
    validate: (v: number | null | undefined) => (v === null || v === undefined || Number.isSafeInteger(v) ? true : "Enter a whole number"),
    ...extra,
  }) as Field;

/**
 * Stock holds and freshness (INV 04, INV 05, D40). Both values are launch settings for Lody to
 * confirm: the hold time is a starting point, and the stock age check is off until she sets it.
 */
export const InventorySettings: GlobalConfig = {
  slug: "inventory-settings",
  label: "Inventory",
  admin: { group: "Settings" },
  access: { read: isStaff, update: isCommerceManager },
  hooks: { afterChange: [auditGlobal(["holdMinutes", "maxStockAgeHours"])] },
  fields: [
    whole("holdMinutes", "Checkout hold (minutes)", "How long stock is set aside while a customer pays. After this the hold is ignored and released.", {
      required: true,
      defaultValue: DEFAULT_HOLD_MINUTES,
      max: 240,
    }),
    whole(
      "maxStockAgeHours",
      "Longest age of a stock count (hours)",
      'Leave empty to switch this off. When set, a product or option whose stock was last counted or synced longer ago than this is treated as unknown and can\'t be bought online ("Currently unavailable").',
    ),
  ],
};

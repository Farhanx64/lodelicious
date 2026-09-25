import type { Cents } from "../money";
import type { GiftSettings, GiftType, SizeCode, SizeRule, SpecialCode, SpecialPresentation } from "./types";

export function sizeRule(settings: GiftSettings, size: SizeCode): SizeRule {
  const rule = settings.sizes.find((s) => s.code === size);
  if (!rule) throw new RangeError(`Basket size "${size}" is not configured`);
  return rule;
}

export function specialPresentation(settings: GiftSettings, code: SpecialCode): SpecialPresentation {
  const p = settings.specialPresentations.find((s) => s.code === code);
  if (!p) throw new RangeError(`Presentation "${code}" is not configured`);
  return p;
}

/** Count range for a custom basket; a gift-type override (large sympathy 13–16) wins. */
export function resolveCountRange(settings: GiftSettings, size: SizeCode, giftType: GiftType): { min: number; max: number } {
  const override = settings.countOverrides.find((o) => o.size === size && o.giftType === giftType);
  if (override) return { min: override.minItems, max: override.maxItems };
  const rule = sizeRule(settings, size);
  return { min: rule.minItems, max: rule.maxItems };
}

/**
 * Packaging charged on top of contents. Only the custom builder charges it; special
 * presentations and curated baskets already include presentation in their price.
 */
export function packagingFor(settings: GiftSettings, kind: "custom" | "special" | "curated", size?: SizeCode): Cents {
  if (kind !== "custom") return 0;
  if (!size) throw new RangeError("A custom basket needs a size");
  return sizeRule(settings, size).packagingCents;
}

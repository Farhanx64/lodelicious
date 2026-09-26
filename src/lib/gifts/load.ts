import type { Payload } from "payload";

import { parseSettings } from "./defaults";
import type { GiftSettings } from "./types";

/** Current gift rules from the admin-edited global, validated. Throws GiftSettingsError if invalid. */
export async function getGiftSettings(payload: Payload): Promise<GiftSettings> {
  const doc = await payload.findGlobal({ slug: "gift-builder-settings", depth: 0, overrideAccess: true });
  return parseSettings(doc as unknown as Record<string, unknown>);
}

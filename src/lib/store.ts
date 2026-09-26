import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";

import type { StoreSetting } from "@/payload-types";

export async function getStoreSettings(): Promise<StoreSetting> {
  const payload = await getPayload({ config });
  return payload.findGlobal({ slug: "store-settings" });
}

/** Anything other than production shows the staging banner (placeholder data may be visible). */
export function isStaging(): boolean {
  return process.env.APP_ENV !== "production";
}

export { isImagePublishable } from "./media";

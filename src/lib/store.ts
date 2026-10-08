import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";

import type { StoreSetting } from "@/payload-types";

import { isPreviewEnv } from "./app-env";

export async function getStoreSettings(): Promise<StoreSetting> {
  const payload = await getPayload({ config });
  return payload.findGlobal({ slug: "store-settings" });
}

/**
 * The staging banner, drafts and placeholder data are shown only when APP_ENV is explicitly
 * local, staging or test. Production, an unset value and anything mistyped are the live store (D41).
 */
export function isStaging(): boolean {
  return isPreviewEnv();
}

export { isImagePublishable } from "./media";

export async function getHomePage() {
  const payload = await getPayload({ config });
  return payload.findGlobal({ slug: "home-page", depth: 1 });
}

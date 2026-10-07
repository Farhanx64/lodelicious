import type { Media } from "@/payload-types";

import { isPreviewEnv, type EnvLike } from "./app-env";

/**
 * Photos may appear on the live store only once Lody has approved them (supplier catalog images
 * stay staging-only). Staging shows everything so the layout can be reviewed. "Live" is anything
 * but an explicit APP_ENV of local, staging or test (D41).
 */
export function isImagePublishable(media: Pick<Media, "approvedForLaunch"> | null | undefined, env: EnvLike = process.env): boolean {
  if (!media) return false;
  return isPreviewEnv(env) || media.approvedForLaunch === true;
}

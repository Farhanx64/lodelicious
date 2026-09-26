import type { Media } from "@/payload-types";

/**
 * Photos may appear on the live store only once Lody has approved them (supplier catalog images
 * stay staging-only). Staging shows everything so the layout can be reviewed.
 */
export function isImagePublishable(media: Pick<Media, "approvedForLaunch"> | null | undefined, appEnv = process.env.APP_ENV): boolean {
  if (!media) return false;
  return appEnv !== "production" || media.approvedForLaunch === true;
}

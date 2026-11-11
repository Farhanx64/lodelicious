import "server-only";

import { headers } from "next/headers";

import { clientIp, withinLimit, type LimitedAction } from "./rate-limit";

/**
 * Call at the top of a public server action. Returns true when this visitor has made too many
 * attempts at `action` and the action should answer with TOO_MANY_ATTEMPTS instead of doing work.
 *
 * On the Node host the count is kept in the process (`rate-limit.ts`); on Cloudflare it is kept by
 * Rate Limiting bindings (`rate-limit-cloudflare.ts`, D51).
 */
export async function isRateLimited(action: LimitedAction): Promise<boolean> {
  const requestHeaders = await headers();
  if (process.env.DEPLOY_TARGET === "cloudflare") {
    const { isRateLimitedOnCloudflare } = await import("./rate-limit-cloudflare");
    return isRateLimitedOnCloudflare(action, requestHeaders);
  }
  return !withinLimit(action, clientIp(requestHeaders));
}

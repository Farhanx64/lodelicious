import "server-only";

import { headers } from "next/headers";

import { clientIp, withinLimit, type LimitedAction } from "./rate-limit";

/**
 * Call at the top of a public server action. Returns true when this visitor has made too many
 * attempts at `action` and the action should answer with TOO_MANY_ATTEMPTS instead of doing work.
 */
export async function isRateLimited(action: LimitedAction): Promise<boolean> {
  return !withinLimit(action, clientIp(await headers()));
}

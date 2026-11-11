import { getCloudflareContext } from "@opennextjs/cloudflare";

import { ACTION_LIMITS } from "./rate-limit";
import { bindingNameFor } from "./rate-limit-cloudflare";
import type { CloudflareRuntimeEnv } from "./system-check";

/** Snapshot of this Worker for `evaluateCloudflare()` (D51). Binding names only; never their contents. */
export async function currentCloudflareRuntimeEnv(): Promise<CloudflareRuntimeEnv> {
  const { env } = await getCloudflareContext({ async: true });
  const rateLimiters = [...new Set(Object.values(ACTION_LIMITS).map(bindingNameFor))].sort();
  return {
    appEnv: process.env.APP_ENV,
    payloadSecretLength: (process.env.PAYLOAD_SECRET ?? "").length,
    bindings: Object.keys(env).filter((name) => typeof (env as unknown as Record<string, unknown>)[name] === "object"),
    requiredBindings: ["D1", "R2", ...rateLimiters],
  };
}

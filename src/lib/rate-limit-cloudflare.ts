/**
 * The rate limiter on Cloudflare (D51).
 *
 * A Worker has no long-lived process: requests land on many short-lived isolates, so the
 * in-memory counts in `rate-limit.ts` would hardly ever add up. Cloudflare's Rate Limiting
 * bindings keep the counts instead. A binding has one fixed rule, so `wrangler.jsonc` declares one
 * binding per distinct per-minute limit in ACTION_LIMITS (RATE_LIMIT_30, RATE_LIMIT_20 and so on)
 * and the key carries the action name, which keeps each action's count separate.
 *
 * Still a speed bump, not a firewall: Cloudflare counts per data centre and the counts are
 * eventually consistent, so a burst can slip a little over the limit.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { ACTION_LIMITS, withinLimit, type LimitedAction, type Rule } from "./rate-limit";

type HeaderReader = { get(name: string): string | null };

type RateLimitBinding = { limit(options: { key: string }): Promise<{ success: boolean }> };

/** The binding that enforces `rule`. Every limit in ACTION_LIMITS needs one in wrangler.jsonc (a test checks this). */
export function bindingNameFor(rule: Rule): string {
  if (rule.windowMs !== 60_000) throw new Error("Cloudflare rate limits here are per minute");
  return `RATE_LIMIT_${rule.limit}`;
}

/**
 * The visitor's address as Cloudflare reports it. `CF-Connecting-IP` is set by Cloudflare on every
 * request and cannot be supplied by the visitor (unlike `X-Forwarded-For`, which Cloudflare only
 * appends to). "unknown" puts header-less callers in one shared bucket, as on the Node host.
 */
export function cloudflareClientIp(headers: HeaderReader): string {
  const ip = headers.get("cf-connecting-ip")?.trim();
  return ip ? ip.slice(0, 64) : "unknown";
}

/** True when this visitor has made too many attempts at `action`. */
export async function isRateLimitedOnCloudflare(action: LimitedAction, headers: HeaderReader): Promise<boolean> {
  const ip = cloudflareClientIp(headers);
  let binding: RateLimitBinding | undefined;
  try {
    const env = getCloudflareContext().env as unknown as Record<string, RateLimitBinding | undefined>;
    binding = env[bindingNameFor(ACTION_LIMITS[action])];
  } catch {
    binding = undefined; // not inside a Worker request (for example `next dev`)
  }
  if (!binding) return !withinLimit(action, ip);
  try {
    return !(await binding.limit({ key: `${action}:${ip}` })).success;
  } catch (e) {
    // The limiter being unavailable must not stop a customer checking out; this isolate's own count still applies.
    console.error(JSON.stringify({ level: "error", msg: "[rate-limit] the Cloudflare limiter failed; using the in-memory count", error: (e as Error).message }));
    return !withinLimit(action, ip);
  }
}

/**
 * A small in-memory, per-process rate limiter for the public server actions (D41, audit A15).
 *
 * It is a speed bump, not a firewall: counts live in this Node process only (they reset on a
 * restart and are not shared between processes), which is enough to stop one script from hammering
 * add-to-bag, checkout or the inquiry forms on the single cPanel Node app. It is keyed by client IP
 * plus action name. Framework-free (the IP lookup that needs `next/headers` is in
 * `rate-limit-server.ts`), so it is unit-tested with a fake clock.
 */

export type Rule = { limit: number; windowMs: number };

export type LimitDecision = { allowed: true } | { allowed: false; retryAfterMs: number };

export type RateLimiter = {
  /** Records one attempt for `key` and says whether it is within `rule`. Denied attempts are not counted. */
  hit(key: string, rule: Rule): LimitDecision;
  /** Number of keys currently tracked (for tests and memory checks). */
  size(): number;
  clear(): void;
};

/** Beyond this many tracked keys, expired entries are dropped, then the least recently used. Bounds memory under a flood of distinct IPs. */
const DEFAULT_MAX_KEYS = 5000;

export function createRateLimiter({ now = Date.now, maxKeys = DEFAULT_MAX_KEYS }: { now?: () => number; maxKeys?: number } = {}): RateLimiter {
  // key -> attempt times (ms) inside the window, oldest first. `windowMs` tells us when a key can be dropped.
  const hits = new Map<string, { times: number[]; windowMs: number }>();

  function prune(at: number) {
    for (const [key, entry] of hits) {
      if (entry.times.length === 0 || at - entry.times[entry.times.length - 1] >= entry.windowMs) hits.delete(key);
    }
    // Still too many (a flood of fresh keys): forget the least recently used ones.
    for (const key of hits.keys()) {
      if (hits.size <= maxKeys) break;
      hits.delete(key);
    }
  }

  return {
    hit(key, rule) {
      const at = now();
      const entry = hits.get(key) ?? { times: [], windowMs: rule.windowMs };
      entry.windowMs = rule.windowMs;
      while (entry.times.length > 0 && at - entry.times[0] >= rule.windowMs) entry.times.shift();
      if (entry.times.length >= rule.limit) {
        hits.set(key, entry);
        return { allowed: false, retryAfterMs: Math.max(0, entry.times[0] + rule.windowMs - at) };
      }
      entry.times.push(at);
      // Re-insert so Map order follows recent use (the first keys are the least recently used).
      hits.delete(key);
      hits.set(key, entry);
      if (hits.size > maxKeys) prune(at);
      return { allowed: true };
    },
    size: () => hits.size,
    clear: () => hits.clear(),
  };
}

const MINUTE = 60_000;

/**
 * Attempts allowed per IP per minute. Generous for real use (a customer retrying a failed payment
 * a few times, or tapping through a basket), low enough that a loop of requests stops quickly.
 */
export const ACTION_LIMITS = {
  addToBag: { limit: 30, windowMs: MINUTE },
  checkBasket: { limit: 20, windowMs: MINUTE },
  startReservation: { limit: 20, windowMs: MINUTE },
  submitOrder: { limit: 6, windowMs: MINUTE },
  submitReservation: { limit: 6, windowMs: MINUTE },
  contact: { limit: 5, windowMs: MINUTE },
  fountain: { limit: 5, windowMs: MINUTE },
} as const satisfies Record<string, Rule>;

export type LimitedAction = keyof typeof ACTION_LIMITS;

/** What the customer sees when limited. */
export const TOO_MANY_ATTEMPTS = "Too many attempts, please wait a minute and try again.";

type HeaderReader = { get(name: string): string | null };

/**
 * The visitor's address as the proxy in front of the Node app reports it. Takes the last
 * `X-Forwarded-For` entry (the one the nearest proxy appended, which a client cannot forge by
 * sending its own header), then `X-Real-IP`; "unknown" when neither exists, so every such visitor
 * shares one bucket rather than escaping the limit.
 */
export function clientIp(headers: HeaderReader): string {
  const forwarded = headers.get("x-forwarded-for");
  const last = forwarded?.split(",").at(-1)?.trim();
  if (last) return last.slice(0, 64);
  const real = headers.get("x-real-ip")?.trim();
  return real ? real.slice(0, 64) : "unknown";
}

/** One limiter per process, shared by every bundle of the server (Next can load this module more than once). */
const GLOBAL_KEY = Symbol.for("lodelicious.rateLimiter");
type GlobalWithLimiter = typeof globalThis & { [GLOBAL_KEY]?: RateLimiter };

export function processLimiter(): RateLimiter {
  const g = globalThis as GlobalWithLimiter;
  return (g[GLOBAL_KEY] ??= createRateLimiter());
}

/** True when this attempt is within the limit for `action`. */
export function withinLimit(action: LimitedAction, ip: string, limiter: RateLimiter = processLimiter()): boolean {
  return limiter.hit(`${action}:${ip}`, ACTION_LIMITS[action]).allowed;
}

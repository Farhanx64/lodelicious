/**
 * Which environment this process is (D41, audit A09).
 *
 * Everything that is only allowed away from the live store (the test payment provider, photos
 * that are not approved for launch, the staging banner, draft policies, PREVIEW_ASSUME_STOCK)
 * is an allowlist: it applies only when APP_ENV is explicitly `local`, `staging` or `test`.
 * Anything else, including an unset or mistyped value, behaves as production. A forgotten
 * variable therefore fails closed instead of opening the live store to test features.
 *
 * Framework-free and free of `server-only`, so collections, scripts, tests and server code can
 * all use it. Every function takes an `env` object (default: this process) so a test can pass
 * `{}` and really get "unset".
 */

/** The only values of APP_ENV that switch preview behaviour on. */
export const PREVIEW_APP_ENVS = ["local", "staging", "test"] as const;
export type PreviewAppEnv = (typeof PREVIEW_APP_ENVS)[number];

/** An environment: `process.env`, or a plain object in tests. */
export type EnvLike = Record<string, string | undefined>;

/** How APP_ENV reads, for the system check and docs. */
export type AppEnvKind = PreviewAppEnv | "production" | "unset" | "unrecognised";

function normalised(env: EnvLike): string {
  return (env.APP_ENV ?? "").trim().toLowerCase();
}

/** True only when APP_ENV is explicitly `local`, `staging` or `test`. */
export function isPreviewEnv(env: EnvLike = process.env): boolean {
  return (PREVIEW_APP_ENVS as readonly string[]).includes(normalised(env));
}

/** The opposite of {@link isPreviewEnv}: the live store, and anything we cannot positively identify. */
export function isProductionEnv(env: EnvLike = process.env): boolean {
  return !isPreviewEnv(env);
}

export function appEnvKind(env: EnvLike = process.env): AppEnvKind {
  const value = normalised(env);
  if (!value) return "unset";
  if (value === "production") return "production";
  return (PREVIEW_APP_ENVS as readonly string[]).includes(value) ? (value as PreviewAppEnv) : "unrecognised";
}

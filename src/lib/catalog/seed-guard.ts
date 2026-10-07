/**
 * A production database that already has products is not seeded again unless someone says so
 * (D41, audit A19). The seed never overwrites an edit, but it does create whatever is missing, so
 * a re-run on the live store would bring back a product staff deleted, an old slug they renamed,
 * a tax class they removed (re-created as approved) and cleared photos (refilled with unapproved
 * placeholders).
 *
 * "Production" follows the APP_ENV allowlist: anything but an explicit local, staging or test,
 * including an unset APP_ENV.
 */
import { isProductionEnv, type EnvLike } from "../app-env";

export type SeedGuardInput = {
  /** Reads APP_ENV and SEED_FORCE. */
  env: EnvLike;
  /**
   * Command-line arguments after the script name. Not used to force a seed: `payload run` hands a
   * script only its positional arguments, so a `--force` flag never arrives. Use SEED_FORCE=1.
   */
  argv: readonly string[];
  /** Products already in the database (published or draft). */
  productCount: number;
};

export type SeedGuardResult = { allowed: true; forced: boolean } | { allowed: false; reason: string };

const TRUTHY = new Set(["1", "true", "yes"]);

export function isSeedForced({ env }: Pick<SeedGuardInput, "env">): boolean {
  return TRUTHY.has((env.SEED_FORCE ?? "").trim().toLowerCase());
}

export function checkSeedAllowed(input: SeedGuardInput): SeedGuardResult {
  const forced = isSeedForced(input);
  if (!isProductionEnv(input.env) || input.productCount === 0) return { allowed: true, forced: false };
  if (forced) return { allowed: true, forced: true };
  const appEnv = input.env.APP_ENV?.trim() ? `APP_ENV=${input.env.APP_ENV.trim()}` : "APP_ENV is not set, which counts as production";
  return {
    allowed: false,
    reason: [
      `Refusing to seed: ${appEnv}, and the database already has ${input.productCount} product${input.productCount === 1 ? "" : "s"}.`,
      "The seed never overwrites edits, but it creates anything that is missing. Run on a live store it would bring back products",
      "that staff deleted, slugs they renamed, a tax class they removed (re-created as approved) and photos they cleared.",
      "If you really mean to run it, set SEED_FORCE=1 in the environment and run it again.",
    ].join("\n"),
  };
}

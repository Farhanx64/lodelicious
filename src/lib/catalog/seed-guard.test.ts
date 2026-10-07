import { describe, expect, it } from "vitest";

import { checkSeedAllowed, isSeedForced } from "./seed-guard";

const run = (env: Record<string, string | undefined>, productCount: number, argv: string[] = []) => checkSeedAllowed({ env, argv, productCount });

describe("checkSeedAllowed (A19)", () => {
  it("refuses a production database that already has products, and says why", () => {
    const result = run({ APP_ENV: "production" }, 120);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("APP_ENV=production");
      expect(result.reason).toContain("120 products");
      expect(result.reason).toContain("SEED_FORCE=1");
      expect(result.reason).toMatch(/deleted|renamed/);
    }
  });

  it("treats an unset or mistyped APP_ENV as production", () => {
    for (const env of [{}, { APP_ENV: "" }, { APP_ENV: "prod" }]) expect(run(env, 3).allowed).toBe(false);
    const unset = run({}, 3);
    expect(!unset.allowed && unset.reason).toContain("not set");
  });

  it("allows the first seed of an empty production database", () => {
    expect(run({ APP_ENV: "production" }, 0)).toEqual({ allowed: true, forced: false });
    expect(run({}, 0)).toEqual({ allowed: true, forced: false });
  });

  it("always allows local, staging and test environments", () => {
    for (const APP_ENV of ["local", "staging", "test"]) expect(run({ APP_ENV }, 500)).toEqual({ allowed: true, forced: false });
  });

  it("allows production with --force or SEED_FORCE, and says it was forced", () => {
    expect(run({ APP_ENV: "production" }, 120, ["--force"])).toEqual({ allowed: true, forced: true });
    expect(run({ APP_ENV: "production", SEED_FORCE: "1" }, 120)).toEqual({ allowed: true, forced: true });
    expect(run({ APP_ENV: "production", SEED_FORCE: "true" }, 120)).toEqual({ allowed: true, forced: true });
  });

  it("does not take a vague SEED_FORCE as a yes", () => {
    for (const SEED_FORCE of ["0", "", "no", "false", "force"]) expect(run({ APP_ENV: "production", SEED_FORCE }, 120).allowed).toBe(false);
    expect(isSeedForced({ env: {}, argv: ["--forced"] })).toBe(false);
  });
});

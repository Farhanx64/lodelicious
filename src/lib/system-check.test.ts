import { describe, expect, it } from "vitest";

import { appEnvCheck, evaluate, type RuntimeEnv } from "./system-check";

const production: RuntimeEnv = {
  nodeVersion: "22.11.0",
  heapLimitMb: 768,
  production: true,
  appEnv: "production",
  payloadSecretLength: 64,
  dataDir: "/home/lody/lodelicious-data",
  dataDirWritable: true,
  publicRoot: "/home/lody/public_html",
};

const failed = (env: RuntimeEnv) => evaluate(env).filter((r) => !r.ok).map((r) => r.check);

describe("evaluate", () => {
  it("passes a correctly configured production host", () => {
    expect(failed(production)).toEqual([]);
  });

  it("fails an uncapped heap in production (the 2 GB LVE would kill the app)", () => {
    expect(failed({ ...production, heapLimitMb: 4144 })).toEqual(["V8 heap limit"]);
  });

  it("does not enforce the heap cap in development", () => {
    expect(failed({ ...production, production: false, heapLimitMb: 8192, dataDir: ".data" })).toEqual([]);
  });

  it("fails Node older than Next 16 needs", () => {
    expect(failed({ ...production, nodeVersion: "18.20.4" })).toEqual(["Node version"]);
    expect(failed({ ...production, nodeVersion: "20.9.0" })).toEqual([]);
  });

  it("fails a missing or short secret", () => {
    expect(failed({ ...production, payloadSecretLength: 0 })).toEqual(["PAYLOAD_SECRET"]);
    expect(failed({ ...production, payloadSecretLength: 16 })).toEqual(["PAYLOAD_SECRET"]);
  });

  it("fails a data dir inside public_html or relative in production", () => {
    expect(failed({ ...production, dataDir: "/home/lody/public_html/data" })).toEqual(["DATA_DIR private"]);
    expect(failed({ ...production, dataDir: "./.data" })).toEqual(["DATA_DIR private"]);
    // A sibling directory whose name merely starts with public_html is not inside it.
    expect(failed({ ...production, dataDir: "/home/lody/public_html_backup" })).toEqual([]);
  });

  it("fails an unwritable data dir", () => {
    expect(failed({ ...production, dataDirWritable: false })).toEqual(["DATA_DIR writable"]);
  });
});

describe("APP_ENV check (D41)", () => {
  it("passes for production and for the explicit preview values", () => {
    for (const appEnv of ["production", "staging", "local", "test"]) {
      expect(failed({ ...production, appEnv })).toEqual([]);
    }
  });

  it("fails when APP_ENV is unset, and says it is treated as production", () => {
    expect(failed({ ...production, appEnv: undefined })).toEqual(["APP_ENV"]);
    expect(appEnvCheck(undefined).actual).toMatch(/unset.*production/);
    expect(appEnvCheck("   ").ok).toBe(false);
  });

  it("fails a mistyped value", () => {
    for (const appEnv of ["prod", "live", "stage", "Productoin"]) {
      const result = appEnvCheck(appEnv);
      expect(result.ok).toBe(false);
      expect(result.actual).toContain(appEnv);
    }
  });

  it("ignores case and surrounding spaces, like the rest of the allowlist", () => {
    expect(appEnvCheck(" Production ").ok).toBe(true);
    expect(appEnvCheck("STAGING").ok).toBe(true);
  });
});

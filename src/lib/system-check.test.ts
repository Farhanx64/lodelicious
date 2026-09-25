import { describe, expect, it } from "vitest";

import { evaluate, type RuntimeEnv } from "./system-check";

const production: RuntimeEnv = {
  nodeVersion: "22.11.0",
  heapLimitMb: 768,
  production: true,
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

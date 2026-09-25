import fs from "node:fs";
import path from "node:path";
import v8 from "node:v8";

import type { RuntimeEnv } from "./system-check";

/** Snapshot of this process for `evaluate()`. Web (Passenger) and shell/cron differ; check both. */
export function currentRuntimeEnv(): RuntimeEnv {
  const production = process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
  const dataDir = process.env.DATA_DIR ?? path.resolve(".data");
  let dataDirWritable = false;
  try {
    fs.accessSync(dataDir, fs.constants.W_OK);
    dataDirWritable = fs.statSync(dataDir).isDirectory();
  } catch {
    dataDirWritable = false;
  }
  const home = process.env.HOME;
  return {
    nodeVersion: process.versions.node,
    heapLimitMb: Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024),
    production,
    payloadSecretLength: (process.env.PAYLOAD_SECRET ?? "").length,
    dataDir,
    dataDirWritable,
    publicRoot: process.env.PUBLIC_ROOT ?? (home ? path.join(home, "public_html") : undefined),
  };
}

/**
 * Runtime requirement checks for the Namecheap Stellar Business host (PRD INF 01, INF 05).
 *
 * The account has a 2 GB physical-memory (LVE) limit shared by every process. A Node server is
 * resident all day, so its V8 heap must be capped well below that (NODE_OPTIONS
 * --max-old-space-size) or the LVE kills the whole app instead of V8 collecting garbage.
 * The cPanel Node app and SSH/cron shells can carry different NODE_OPTIONS, so check both.
 */
import path from "node:path";

export const MIN_NODE = "20.9.0";
export const MAX_HEAP_MB = 1024;
export const MIN_SECRET_LENGTH = 32;

export type CheckResult = { check: string; expected: string; actual: string; ok: boolean };

export type RuntimeEnv = {
  nodeVersion: string;
  heapLimitMb: number;
  production: boolean;
  payloadSecretLength: number;
  dataDir: string;
  dataDirWritable: boolean;
  /** Absolute path of the public web root, when known (e.g. /home/user/public_html). */
  publicRoot?: string;
};

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function evaluate(env: RuntimeEnv): CheckResult[] {
  const results: CheckResult[] = [
    {
      check: "Node version",
      expected: `>= ${MIN_NODE}`,
      actual: env.nodeVersion,
      ok: compareVersions(env.nodeVersion, MIN_NODE) >= 0,
    },
    {
      check: "V8 heap limit",
      expected: `<= ${MAX_HEAP_MB} MB (NODE_OPTIONS=--max-old-space-size=768)`,
      actual: `${env.heapLimitMb} MB`,
      // Only enforced in production: development machines have no LVE limit.
      ok: !env.production || env.heapLimitMb <= MAX_HEAP_MB,
    },
    {
      check: "PAYLOAD_SECRET",
      expected: `set, >= ${MIN_SECRET_LENGTH} chars`,
      actual: env.payloadSecretLength === 0 ? "missing" : `${env.payloadSecretLength} chars`,
      ok: env.payloadSecretLength >= MIN_SECRET_LENGTH,
    },
    {
      check: "DATA_DIR writable",
      expected: "writable directory",
      actual: env.dataDirWritable ? "writable" : "not writable",
      ok: env.dataDirWritable,
    },
  ];

  if (env.production) {
    const absolute = path.isAbsolute(env.dataDir);
    const exposed = env.publicRoot !== undefined && isInside(path.resolve(env.dataDir), env.publicRoot);
    results.push({
      check: "DATA_DIR private",
      expected: "absolute path outside public_html",
      actual: !absolute ? "relative path" : exposed ? "inside public web root" : "ok",
      ok: absolute && !exposed,
    });
  }

  return results;
}

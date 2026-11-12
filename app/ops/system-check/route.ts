import config from "@payload-config";
import { headers } from "next/headers";
import { getPayload } from "payload";

import { canManageCommerce } from "@/src/access/roles";
import { cloverConfigured } from "@/src/lib/clover/get-adapter";
import { cloverHealthChecks, getCloverSyncHealth } from "@/src/lib/clover/health";
import { paymentsCheck } from "@/src/lib/payments";
import { evaluate, evaluateCloudflare, type CheckResult } from "@/src/lib/system-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The checks for the host this build runs on (D51). Each side imports only what exists on its host. */
async function runtimeChecks(): Promise<CheckResult[]> {
  if (process.env.DEPLOY_TARGET === "cloudflare") {
    const { currentCloudflareRuntimeEnv } = await import("@/src/lib/runtime-env-cloudflare");
    return evaluateCloudflare(await currentCloudflareRuntimeEnv());
  }
  const { currentRuntimeEnv } = await import("@/src/lib/runtime-env");
  return evaluate(currentRuntimeEnv());
}

/**
 * Runtime checks as the web app itself sees them (its own environment, and on Cloudflare its
 * bindings). Owner/manager only: the response reveals configuration details. Log in at /admin first.
 */
export async function GET() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });
  if (!canManageCommerce(user)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const results = await runtimeChecks();
  results.push(paymentsCheck());
  try {
    results.push(...cloverHealthChecks(await getCloverSyncHealth(payload, new Date()), cloverConfigured()));
  } catch (e) {
    results.push({ check: "Clover sync", expected: "readable", actual: `could not be read: ${(e as Error).message}`, ok: false });
  }
  return Response.json({ ok: results.every((r) => r.ok), results }, { headers: { "Cache-Control": "no-store" } });
}

import config from "@payload-config";
import { headers } from "next/headers";
import { getPayload } from "payload";

import { canManageCommerce } from "@/src/access/roles";
import { currentRuntimeEnv } from "@/src/lib/runtime-env";
import { evaluate } from "@/src/lib/system-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Web-process runtime checks (the cPanel Node app's own NODE_OPTIONS and env). Owner/manager
 * only: the response reveals configuration details. Log in at /admin first.
 */
export async function GET() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });
  if (!canManageCommerce(user)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const results = evaluate(currentRuntimeEnv());
  return Response.json({ ok: results.every((r) => r.ok), results }, { headers: { "Cache-Control": "no-store" } });
}

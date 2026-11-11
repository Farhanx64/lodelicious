import config from "@payload-config";
import { getPayload } from "payload";

import { CRON_KEY_HEADER, isValidCronKey } from "@/src/lib/jobs/cron-key";
import { isJobName, runJob } from "@/src/lib/jobs/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Runs one scheduled job inside the app (D51). On Cloudflare there is no shell for
 * `payload run scripts/<name>.ts`, so a Cron Trigger calls the Worker's `scheduled` handler
 * (`cloudflare-worker.mjs`), which posts here with a key derived from PAYLOAD_SECRET. Anyone
 * without the key, and any unknown job, gets the same 404 as a page that does not exist.
 */
export async function POST(request: Request, { params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  if (!isJobName(job) || !isValidCronKey(job, request.headers.get(CRON_KEY_HEADER), process.env.PAYLOAD_SECRET)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const payload = await getPayload({ config });
  const result = await runJob(payload, job);
  for (const line of result.lines) (result.ok ? console.log : console.error)(`[${job}] ${line}`);
  return Response.json(result, { status: result.ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}

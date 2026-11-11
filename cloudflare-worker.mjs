/**
 * The Worker entry on Cloudflare (D51): OpenNext's generated Worker for requests, plus a
 * `scheduled` handler so Cron Triggers can run the jobs that were cron scripts on the Node host.
 * `wrangler.jsonc` points `main` here. `.open-next/` exists only after `npm run cf:build`.
 *
 * See https://opennext.js.org/cloudflare/howtos/custom-worker
 */
import openNextWorker from "./.open-next/worker.js";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

/** Cron expression (as written in wrangler.jsonc `triggers.crons`) to the jobs it runs. */
const SCHEDULE = {
  "*/5 * * * *": ["release-expired-holds"],
  "*/10 * * * *": ["send-pending-emails"],
  "17 8 * * *": ["purge-carts"],
  "*/15 * * * *": ["clover-pull"],
  // Add once pushing to Clover is approved (docs/clover-sync-needs.md), with the same line in wrangler.jsonc:
  // "*/2 * * * *": ["clover-push"],
};

/** Same value as `cronKey()` in src/lib/jobs/cron-key.ts: hex HMAC-SHA256 of "cron:<job>" under PAYLOAD_SECRET. */
async function cronKey(job, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`cron:${job}`));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Runs one job by calling the app's own route in this isolate; nothing goes over the network. */
async function runJob(job, env, ctx) {
  const request = new Request(`https://cron.internal/ops/cron/${job}`, {
    method: "POST",
    headers: { "x-cron-key": await cronKey(job, env.PAYLOAD_SECRET ?? "") },
  });
  const response = await openNextWorker.fetch(request, env, ctx);
  const body = await response.text();
  if (!response.ok) throw new Error(`${job} answered ${response.status}: ${body.slice(0, 500)}`);
  console.log(JSON.stringify({ level: "info", msg: `[cron] ${job}`, result: body.slice(0, 2000) }));
}

const worker = {
  fetch: openNextWorker.fetch,

  /** @param {{ cron: string }} controller */
  async scheduled(controller, env, ctx) {
    const jobs = SCHEDULE[controller.cron];
    if (!jobs) {
      console.error(JSON.stringify({ level: "error", msg: `[cron] no job is mapped to "${controller.cron}"` }));
      return;
    }
    // One after another: they share the database, and a failure in one must not hide the next.
    // A job that throws marks the whole invocation failed, which is what shows up in Cron Events.
    const failures = [];
    for (const job of jobs) {
      try {
        await runJob(job, env, ctx);
      } catch (e) {
        console.error(JSON.stringify({ level: "error", msg: `[cron] ${job} failed`, error: e instanceof Error ? e.message : String(e) }));
        failures.push(job);
      }
    }
    if (failures.length) throw new Error(`Scheduled job(s) failed: ${failures.join(", ")}`);
  },
};

export default worker;

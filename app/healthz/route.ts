import config from "@payload-config";
import { getPayload } from "payload";

// Force the full Node.js runtime (never edge) — required on cPanel/Passenger.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Cheapest query that proves the DB is actually reachable. The count itself
    // is deliberately not returned — see below.
    const payload = await getPayload({ config });
    await payload.count({ collection: "users" });
    return Response.json({ status: "ok", db: "reachable" });
  } catch (err) {
    // Details stay in the server log. The response body is public, so it must
    // not carry user counts, the Node version, or raw driver/path errors.
    console.error("[healthz] Health check failed:", err);
    return Response.json({ status: "error" }, { status: 503 });
  }
}

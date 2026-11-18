import { quoteLiveShipping } from "@/src/lib/checkout/service";
import { bagToken, checkoutPayload } from "@/src/lib/checkout/session";
import { withinLimit } from "@/src/lib/rate-limit";
import { requestIp } from "@/src/lib/rate-limit-server";

/**
 * The checkout page's live shipping price for the bag in this browser and a ZIP (D67). Returns the
 * cents placeOrder will charge, so the page's total matches. Only the ZIP and state are sent.
 */
export async function POST(request: Request): Promise<Response> {
  if (!withinLimit("shipQuote", (await requestIp()) ?? "unknown")) return Response.json({ error: "busy" }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { zip?: unknown; state?: unknown };
  const zip = String(body.zip ?? "").trim().slice(0, 5);
  const state = String(body.state ?? "").trim().toUpperCase().slice(0, 2);
  if (!/^\d{5}$/.test(zip) || !/^[A-Z]{2}$/.test(state)) return Response.json({ error: "zip" }, { status: 400 });
  const { payload, ctx } = await checkoutPayload();
  const quote = await quoteLiveShipping(payload, await bagToken(), ctx, { zip, state });
  if (!quote) return Response.json({ error: "not_shippable" }, { status: 409 });
  return Response.json(quote, { headers: { "Cache-Control": "no-store" } });
}

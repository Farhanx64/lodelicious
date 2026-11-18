import { quoteLiveBasketShipping, quoteLiveShipping } from "@/src/lib/checkout/service";
import { bagToken, checkoutPayload, readBasketDraft } from "@/src/lib/checkout/session";
import { withinLimit } from "@/src/lib/rate-limit";
import { requestIp } from "@/src/lib/rate-limit-server";

/**
 * The checkout page's live shipping price for the bag in this browser and a ZIP (D67). Returns the
 * cents placeOrder will charge, so the page's total matches. Only the ZIP and state are sent.
 */
export async function POST(request: Request): Promise<Response> {
  if (!withinLimit("shipQuote", (await requestIp()) ?? "unknown")) return Response.json({ error: "busy" }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { zip?: unknown; state?: unknown; kind?: unknown };
  const zip = String(body.zip ?? "").trim().slice(0, 5);
  const state = String(body.state ?? "").trim().toUpperCase().slice(0, 2);
  if (!/^\d{5}$/.test(zip) || !/^[A-Z]{2}$/.test(state)) return Response.json({ error: "zip" }, { status: 400 });
  const { payload, ctx } = await checkoutPayload();
  // "basket": the Build a Basket draft on the reserve page; anything else: the bag on checkout.
  const quote =
    body.kind === "basket" ? await quoteLiveBasketShipping(payload, await readBasketDraft(), ctx, { zip, state }) : await quoteLiveShipping(payload, await bagToken(), ctx, { zip, state });
  if ("error" in quote) return Response.json(quote, { status: quote.error === "no_rate" ? 503 : 409 });
  return Response.json(quote, { headers: { "Cache-Control": "no-store" } });
}

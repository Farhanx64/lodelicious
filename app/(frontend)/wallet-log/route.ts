/**
 * Temporary Apple Pay diagnostics (D62). The checkout page beacons the names of the messages
 * Clover's Apple Pay frame sends, plus page errors, so `wrangler tail` shows why the sheet closes.
 * Only event names and short error text are kept: no card, address, email or token data.
 */
const MAX_BYTES = 4096;
const SAFE = /[^\w .:/()'",=-]/g;

export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const b = body as { id?: unknown; ua?: unknown; events?: unknown };
  const events = Array.isArray(b.events) ? b.events.slice(0, 60).map((e) => String(e).replace(SAFE, "").slice(0, 200)) : [];
  console.log("[applepay-diag]", JSON.stringify({ id: String(b.id ?? "").slice(0, 16), ua: String(b.ua ?? "").slice(0, 160), events }));
  return new Response(null, { status: 204 });
}

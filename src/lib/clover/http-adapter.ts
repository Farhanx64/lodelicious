/**
 * The real Clover REST adapter (D43). **STUB: NOT VERIFIED AGAINST CLOVER AND NEVER CALLED IN TESTS.**
 *
 * Written from general knowledge of Clover's documented REST API, conservatively, with no network
 * access while building. Everything in the VERIFY list must be checked in the Clover *sandbox*
 * before this is used with real data:
 *
 *   1. Base URLs (sandbox https://apisandbox.dev.clover.com, production https://api.clover.com).
 *      Merchants in Europe or Latin America use other hosts; they are refused here.
 *   2. `GET /v3/merchants/{mId}/items?expand=itemStock&limit=&offset=`: response shape
 *      `{ elements: [{ id, name, itemStock: { quantity, stockCount } }] }`, page size limit, and
 *      whether `quantity` or `stockCount` is the on-hand number. Items with no itemStock are untracked.
 *   3. `GET /v3/merchants/{mId}/item_stocks/{itemId}`: same fields.
 *   4. **Absolute vs delta.** Clover's item_stocks update (`POST /v3/merchants/{mId}/item_stocks/{itemId}`
 *      with `{ quantity }`) is believed to SET an absolute number. This stub therefore reads the
 *      current quantity, adds the website's delta and writes the result back (the small race with an
 *      in-store sale in between is accepted, D43). If the sandbox shows a real delta endpoint, use it.
 *   5. Whether any idempotency header is honoured. `Idempotency-Key` is sent but may be ignored. A
 *      request that times out after Clover applied it will then be applied twice on retry; the next
 *      stock read makes Clover win (the website only ever sells less, never more).
 *   6. Retry-After on 429, and the token scopes needed (inventory read and write only).
 *   7. Whether deleted items appear in the list, and how option-level stock is modelled.
 *
 * Safety: refuses to be built unless CLOVER_ENVIRONMENT, CLOVER_MERCHANT_ID and CLOVER_API_TOKEN are all
 * set, and refuses CLOVER_ENVIRONMENT=production unless CLOVER_SYNC_LIVE=1. The token is never logged.
 */
import {
  CloverPermanentError,
  CloverTransientError,
  type CloverInventoryAdapter,
  type CloverPage,
  type CloverPushResult,
  type CloverStockChange,
  type CloverStockItem,
} from "./adapter";

export const CLOVER_BASE_URLS = { sandbox: "https://apisandbox.dev.clover.com", production: "https://api.clover.com" } as const;
export const DEFAULT_TIMEOUT_MS = 10_000;

type EnvLike = Record<string, string | undefined>;
type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal: AbortSignal }) => Promise<Response>;

export type HttpAdapterOptions = { timeoutMs?: number; fetch?: FetchLike };

const ID = /^[A-Za-z0-9]{6,40}$/;

export class HttpCloverAdapter implements CloverInventoryAdapter {
  readonly kind = "http" as const;
  private readonly base: string;
  private readonly merchantId: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  /** Throws `CloverPermanentError("config")` unless the environment is complete and allowed. */
  constructor(env: EnvLike, opts: HttpAdapterOptions = {}) {
    const environment = (env.CLOVER_ENVIRONMENT ?? "").trim().toLowerCase();
    const merchantId = (env.CLOVER_MERCHANT_ID ?? "").trim();
    const token = (env.CLOVER_API_TOKEN ?? "").trim();
    const missing = [!environment && "CLOVER_ENVIRONMENT", !merchantId && "CLOVER_MERCHANT_ID", !token && "CLOVER_API_TOKEN"].filter(Boolean);
    if (missing.length) throw new CloverPermanentError(`Clover is not configured: ${missing.join(", ")} not set`, "config");
    if (environment !== "sandbox" && environment !== "production") {
      throw new CloverPermanentError(`CLOVER_ENVIRONMENT must be "sandbox" or "production" (got "${environment}")`, "config");
    }
    if (environment === "production" && env.CLOVER_SYNC_LIVE !== "1") {
      throw new CloverPermanentError("Refusing to use the production Clover account: set CLOVER_SYNC_LIVE=1 to allow it", "config");
    }
    if (!ID.test(merchantId)) throw new CloverPermanentError("CLOVER_MERCHANT_ID does not look like a Clover merchant ID", "config");
    this.base = CLOVER_BASE_URLS[environment];
    this.merchantId = merchantId;
    this.token = token;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetch ?? ((url, init) => fetch(url, init));
  }

  private url(path: string): string {
    return `${this.base}/v3/merchants/${this.merchantId}${path}`;
  }

  private async request(method: "GET" | "POST", url: string, body?: unknown, idempotencyKey?: string): Promise<unknown> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.token}`, Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey; // VERIFY (5)
    let res: Response;
    try {
      res = await this.fetchImpl(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (e) {
      const name = (e as Error)?.name;
      if (name === "TimeoutError" || name === "AbortError") throw new CloverTransientError(`Clover request timed out after ${this.timeoutMs} ms`, "timeout");
      throw new CloverTransientError("Could not reach Clover", "network");
    }
    if (res.ok) {
      try {
        return await res.json();
      } catch {
        throw new CloverTransientError("Clover returned an unreadable response", "server");
      }
    }
    if (res.status === 429) {
      const seconds = Number(res.headers.get("retry-after"));
      throw new CloverTransientError("Clover is rate limiting requests (429)", "rate_limited", Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 3600) * 1000 : null);
    }
    if (res.status === 408 || res.status >= 500) throw new CloverTransientError(`Clover returned ${res.status}`, res.status === 408 ? "timeout" : "server");
    if (res.status === 401 || res.status === 403) throw new CloverPermanentError(`Clover refused the credentials (${res.status})`, "auth");
    if (res.status === 404) throw new CloverPermanentError("Clover item not found (404)", "not_found");
    throw new CloverPermanentError(`Clover rejected the request (${res.status})`, "rejected");
  }

  async listItems(opts: { cursor: string | null; limit: number }): Promise<CloverPage> {
    const offset = opts.cursor === null ? 0 : Number(opts.cursor);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new CloverPermanentError("Bad Clover paging cursor", "rejected");
    const limit = Math.min(Math.max(1, Math.trunc(opts.limit)), 100);
    const json = (await this.request("GET", this.url(`/items?expand=itemStock&limit=${limit}&offset=${offset}`))) as { elements?: unknown[] };
    const elements = Array.isArray(json?.elements) ? json.elements : [];
    const items = elements.flatMap((e) => {
      const item = toItem(e);
      return item ? [item] : [];
    });
    return { items, nextCursor: elements.length >= limit ? String(offset + elements.length) : null };
  }

  async getItemStock(cloverId: string): Promise<CloverStockItem> {
    assertId(cloverId);
    const json = (await this.request("GET", this.url(`/item_stocks/${cloverId}`))) as { quantity?: unknown; stockCount?: unknown };
    return { cloverId, name: null, quantity: numberOrNull(json?.quantity ?? json?.stockCount) };
  }

  async pushStockChange(change: CloverStockChange): Promise<CloverPushResult> {
    assertId(change.cloverId);
    if (!Number.isSafeInteger(change.delta)) throw new CloverPermanentError("Stock change is not a whole number", "rejected");
    // VERIFY (4): read-modify-write because the update endpoint is believed to be absolute.
    const current = await this.getItemStock(change.cloverId);
    const next = Math.max(0, (current.quantity ?? 0) + change.delta);
    await this.request("POST", this.url(`/item_stocks/${change.cloverId}`), { quantity: next }, change.idempotencyKey);
    return { applied: true, quantity: next };
  }
}

function assertId(id: string): void {
  if (!ID.test(id)) throw new CloverPermanentError("Not a Clover item ID", "rejected");
}

function numberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function toItem(e: unknown): CloverStockItem | null {
  const o = e as { id?: unknown; name?: unknown; itemStock?: { quantity?: unknown; stockCount?: unknown } | null };
  if (typeof o?.id !== "string" || !o.id) return null;
  return { cloverId: o.id, name: typeof o.name === "string" ? o.name : null, quantity: numberOrNull(o.itemStock?.quantity ?? o.itemStock?.stockCount) };
}

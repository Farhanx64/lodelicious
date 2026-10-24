/**
 * The seam between the sync workers and Clover (PRD INV 03/05/06, D43). The workers only know this
 * interface; tests and local dry runs use `FakeCloverAdapter`, and `HttpCloverAdapter` is the
 * (unverified, never-yet-called) real thing. Framework free.
 *
 * Errors are typed so the workers can decide without parsing messages:
 * - `CloverTransientError` (timeout, 429, 5xx, network): try again later, with backoff.
 * - `CloverPermanentError` (bad request, item gone, bad credentials): retrying cannot help.
 */

/** One Clover item with its stock. `quantity` is null when Clover does not track stock for it. */
export type CloverStockItem = { cloverId: string; name: string | null; quantity: number | null };

export type CloverPage = { items: CloverStockItem[]; /** Opaque; null on the last page. */ nextCursor: string | null };

export type CloverStockChange = {
  cloverId: string;
  /** Signed change from the website's ledger. */
  delta: number;
  /** What the website's count was after the change (informational: never pushed as an absolute). */
  quantityAfter: number;
  /** Stable per outbox row, so a retry can never apply twice (where Clover honours it). */
  idempotencyKey: string;
};

export type CloverPushResult = {
  /** False when Clover had already seen this idempotency key. */
  applied: boolean;
  /** Clover's quantity afterwards, when known. */
  quantity: number | null;
};

export interface CloverInventoryAdapter {
  readonly kind: "fake" | "http";
  /** One page of items with their stock. `cursor` null starts at the beginning. */
  listItems(opts: { cursor: string | null; limit: number }): Promise<CloverPage>;
  /** One item's stock. */
  getItemStock(cloverId: string): Promise<CloverStockItem>;
  /** Apply a stock change exactly once per idempotency key. */
  pushStockChange(change: CloverStockChange): Promise<CloverPushResult>;
}

export type TransientKind = "timeout" | "rate_limited" | "server" | "network";
export type PermanentKind = "auth" | "not_found" | "rejected" | "config";

export class CloverError extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
  ) {
    super(message);
    this.name = "CloverError";
  }
}

export class CloverTransientError extends CloverError {
  constructor(
    message: string,
    readonly kind: TransientKind,
    /** From Retry-After on a 429, when given. */
    readonly retryAfterMs: number | null = null,
  ) {
    super(message, true);
    this.name = "CloverTransientError";
  }
}

export class CloverPermanentError extends CloverError {
  constructor(
    message: string,
    readonly kind: PermanentKind,
  ) {
    super(message, false);
    this.name = "CloverPermanentError";
  }
}

export const isTransient = (e: unknown): e is CloverTransientError => e instanceof CloverTransientError;
export const isPermanent = (e: unknown): e is CloverPermanentError => e instanceof CloverPermanentError;
/** Credentials or configuration are wrong: every call will fail the same way, so a run should stop. */
export const isFatal = (e: unknown): boolean => e instanceof CloverPermanentError && (e.kind === "auth" || e.kind === "config");

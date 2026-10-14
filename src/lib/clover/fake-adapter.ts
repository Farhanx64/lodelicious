/**
 * In-memory Clover for tests and local dry runs (D43). Never talks to a network. It can be scripted
 * to fail, throttle or time out, and it records every call.
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

export type FakeOp = "listItems" | "getItemStock" | "pushStockChange";
export type FakeCall = { op: FakeOp; args: unknown };

type Scripted = { error: Error; /** Apply the change before failing, like a request that timed out after Clover processed it. */ applyFirst: boolean };

export class FakeCloverAdapter implements CloverInventoryAdapter {
  readonly kind = "fake" as const;
  readonly calls: FakeCall[] = [];
  private readonly stock = new Map<string, { name: string | null; quantity: number | null }>();
  private readonly seenKeys = new Set<string>();
  private readonly scripts: Record<FakeOp, Scripted[]> = { listItems: [], getItemStock: [], pushStockChange: [] };

  /** `autoCreate`: an unknown item springs into existence on its first push (local dry runs). */
  constructor(
    items: CloverStockItem[] = [],
    private readonly opts: { autoCreate?: boolean } = {},
  ) {
    for (const i of items) this.stock.set(i.cloverId, { name: i.name, quantity: i.quantity });
  }

  // ---- scripting

  /** Fail the next `times` calls to `op` with `error`. */
  failNext(op: FakeOp, error: Error, times = 1, opts: { applyFirst?: boolean } = {}): this {
    for (let i = 0; i < times; i++) this.scripts[op].push({ error, applyFirst: opts.applyFirst ?? false });
    return this;
  }
  timeoutNext(op: FakeOp, times = 1, opts: { applyFirst?: boolean } = {}): this {
    return this.failNext(op, new CloverTransientError("fake: request timed out", "timeout"), times, opts);
  }
  throttleNext(op: FakeOp, retryAfterMs: number | null = null, times = 1): this {
    return this.failNext(op, new CloverTransientError("fake: rate limited (429)", "rate_limited", retryAfterMs), times);
  }
  serverErrorNext(op: FakeOp, times = 1): this {
    return this.failNext(op, new CloverTransientError("fake: Clover returned 503", "server"), times);
  }
  rejectNext(op: FakeOp, kind: "rejected" | "not_found" | "auth" = "rejected", times = 1): this {
    return this.failNext(op, new CloverPermanentError(`fake: ${kind}`, kind), times);
  }

  setItem(item: CloverStockItem): this {
    this.stock.set(item.cloverId, { name: item.name, quantity: item.quantity });
    return this;
  }
  setQuantity(cloverId: string, quantity: number | null): this {
    const cur = this.stock.get(cloverId);
    if (!cur) throw new Error(`Unknown fake item ${cloverId}`);
    cur.quantity = quantity;
    return this;
  }
  quantityOf(cloverId: string): number | null | undefined {
    return this.stock.get(cloverId)?.quantity;
  }
  callsTo(op: FakeOp): FakeCall[] {
    return this.calls.filter((c) => c.op === op);
  }

  // ---- adapter

  private nextScript(op: FakeOp): Scripted | null {
    return this.scripts[op].shift() ?? null;
  }

  async listItems(opts: { cursor: string | null; limit: number }): Promise<CloverPage> {
    this.calls.push({ op: "listItems", args: opts });
    const s = this.nextScript("listItems");
    if (s) throw s.error;
    const ids = [...this.stock.keys()];
    const start = opts.cursor === null ? 0 : Number(opts.cursor);
    if (!Number.isSafeInteger(start) || start < 0) throw new CloverPermanentError("fake: bad cursor", "rejected");
    const slice = ids.slice(start, start + opts.limit);
    const next = start + opts.limit < ids.length ? String(start + opts.limit) : null;
    return { items: slice.map((id) => ({ cloverId: id, name: this.stock.get(id)!.name, quantity: this.stock.get(id)!.quantity })), nextCursor: next };
  }

  async getItemStock(cloverId: string): Promise<CloverStockItem> {
    this.calls.push({ op: "getItemStock", args: { cloverId } });
    const s = this.nextScript("getItemStock");
    if (s) throw s.error;
    const item = this.stock.get(cloverId);
    if (!item) throw new CloverPermanentError(`fake: item ${cloverId} not found`, "not_found");
    return { cloverId, name: item.name, quantity: item.quantity };
  }

  async pushStockChange(change: CloverStockChange): Promise<CloverPushResult> {
    this.calls.push({ op: "pushStockChange", args: change });
    const s = this.nextScript("pushStockChange");
    if (s && !s.applyFirst) throw s.error;
    const result = this.apply(change);
    if (s) throw s.error;
    return result;
  }

  private apply(change: CloverStockChange): CloverPushResult {
    if (!this.stock.has(change.cloverId) && this.opts.autoCreate) this.stock.set(change.cloverId, { name: null, quantity: 0 });
    const item = this.stock.get(change.cloverId);
    if (!item) throw new CloverPermanentError(`fake: item ${change.cloverId} not found`, "not_found");
    if (this.seenKeys.has(change.idempotencyKey)) return { applied: false, quantity: item.quantity };
    this.seenKeys.add(change.idempotencyKey);
    item.quantity = (item.quantity ?? 0) + change.delta;
    return { applied: true, quantity: item.quantity };
  }
}

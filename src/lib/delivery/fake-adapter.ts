/** In-memory courier for tests and local/staging runs. Never usable on the live store (see get-adapter.ts). */
import {
  DeliveryError,
  type Delivery,
  type DeliveryAdapter,
  type DispatchRequest,
  type Quote,
  type QuoteRequest,
} from "./adapter";

export class FakeDeliveryAdapter implements DeliveryAdapter {
  readonly id = "fake" as const;
  private deliveries = new Map<string, Delivery>();
  private byKey = new Map<string, string>();
  private n = 0;

  constructor(
    private opts: { feeCents?: number; servedZips?: string[]; now?: () => Date } = {},
  ) {}

  private now() {
    return this.opts.now?.() ?? new Date();
  }

  async quote(req: QuoteRequest): Promise<Quote> {
    const { servedZips } = this.opts;
    if (servedZips && !servedZips.includes(req.dropoff.zip)) throw new DeliveryError("Outside the delivery area", "no_coverage");
    const now = this.now();
    return {
      provider: this.id,
      quoteId: `fq_${++this.n}`,
      courierFeeCents: this.opts.feeCents ?? 899,
      expiresAt: new Date(now.getTime() + 15 * 60_000),
      estimatedDropoffAt: new Date(now.getTime() + 45 * 60_000),
    };
  }

  async dispatch(req: DispatchRequest): Promise<Delivery> {
    const existing = this.byKey.get(req.idempotencyKey);
    if (existing) return this.deliveries.get(existing)!;
    if (req.quote.expiresAt <= this.now()) throw new DeliveryError("Quote expired", "quote_expired");
    const d: Delivery = { provider: this.id, deliveryId: `fd_${++this.n}`, status: "created", trackingUrl: null };
    this.deliveries.set(d.deliveryId, d);
    this.byKey.set(req.idempotencyKey, d.deliveryId);
    return d;
  }

  async getDelivery(id: string): Promise<Delivery> {
    const d = this.deliveries.get(id);
    if (!d) throw new DeliveryError("Delivery not found", "rejected");
    return d;
  }

  async cancel(id: string): Promise<Delivery> {
    const d = await this.getDelivery(id);
    if (d.status === "picked_up" || d.status === "delivered") throw new DeliveryError("Too late to cancel", "rejected");
    d.status = "cancelled";
    return d;
  }
}

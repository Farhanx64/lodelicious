import { describe, expect, it } from "vitest";

import { DeliveryError, type DeliveryAddress } from "./adapter";
import { FakeDeliveryAdapter } from "./fake-adapter";
import { getDeliveryAdapter } from "./get-adapter";
import { customerDeliveryFee } from "./pricing";

const dropoff: DeliveryAddress = { line1: "1 Main St", city: "Boston", state: "MA", zip: "02108", phone: "+16175550100", name: "Test" };

describe("delivery", () => {
  it("dispatch is idempotent per key", async () => {
    const a = new FakeDeliveryAdapter();
    const quote = await a.quote({ dropoff, orderValueCents: 5000, readyAt: null });
    const req = { quote, orderNumber: "A1", dropoff, idempotencyKey: "k1", items: [] };
    const [d1, d2] = [await a.dispatch(req), await a.dispatch(req)];
    expect(d2.deliveryId).toBe(d1.deliveryId);
  });
  it("rejects an expired quote and cannot cancel after pickup", async () => {
    let t = new Date("2026-01-01T00:00:00Z");
    const a = new FakeDeliveryAdapter({ now: () => t });
    const quote = await a.quote({ dropoff, orderValueCents: 5000, readyAt: null });
    t = new Date(t.getTime() + 16 * 60_000);
    await expect(a.dispatch({ quote, orderNumber: "A2", dropoff, idempotencyKey: "k2", items: [] })).rejects.toMatchObject({ kind: "quote_expired" });
  });
  it("refuses areas outside coverage", async () => {
    const a = new FakeDeliveryAdapter({ servedZips: ["02139"] });
    await expect(a.quote({ dropoff, orderValueCents: 5000, readyAt: null })).rejects.toBeInstanceOf(DeliveryError);
  });
  it("prices the customer fee", () => {
    const p = { markupCents: 100, freeOverCents: 10000, minimumCents: 2500 };
    expect(customerDeliveryFee(899, 2000, p)).toEqual({ eligible: false, reason: "below_minimum" });
    expect(customerDeliveryFee(899, 5000, p)).toEqual({ eligible: true, feeCents: 999 });
    expect(customerDeliveryFee(899, 10000, p)).toEqual({ eligible: true, feeCents: 0 });
  });
  it("is off by default and fake is blocked live", () => {
    expect(getDeliveryAdapter({}).kind).toBe("none");
    expect(() => getDeliveryAdapter({ DELIVERY_ADAPTER: "fake", APP_ENV: "production" })).toThrow();
    expect(getDeliveryAdapter({ DELIVERY_ADAPTER: "fake", APP_ENV: "test" }).kind).toBe("ready");
  });
});

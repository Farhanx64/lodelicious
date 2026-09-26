import { describe, expect, it } from "vitest";

import { availabilityOf, type AvailabilityInput } from "./availability";

const base: AvailabilityInput = {
  channel: "online",
  priceCents: 425,
  priceApproved: true,
  stockState: "known",
  stockQuantity: 10,
  lowStockThreshold: 3,
};

describe("availabilityOf (PRD INV 05)", () => {
  it("sells approved, counted stock", () => {
    expect(availabilityOf(base)).toMatchObject({ status: "available", purchasable: true });
  });

  it("labels known low stock but still sells it", () => {
    expect(availabilityOf({ ...base, stockQuantity: 3 })).toMatchObject({ status: "low_stock", purchasable: true, label: "Low stock" });
  });

  it.each([
    ["unknown stock", { stockState: "unknown" as const }],
    ["no quantity", { stockQuantity: null }],
    ["sold out", { stockQuantity: 0 }],
    ["unapproved price", { priceApproved: false }],
    ["missing price", { priceCents: null }],
  ])("shows %s as Currently unavailable (visible, not purchasable)", (_label, patch) => {
    expect(availabilityOf({ ...base, ...patch })).toMatchObject({ status: "unavailable", purchasable: false, label: "Currently unavailable" });
  });

  it("never sells in-store-only, inquiry-only or hidden products online", () => {
    expect(availabilityOf({ ...base, channel: "in_store_only" })).toMatchObject({ purchasable: false, label: "Available in our shop" });
    expect(availabilityOf({ ...base, channel: "inquiry_only" })).toMatchObject({ purchasable: false, label: "Available by inquiry" });
    expect(availabilityOf({ ...base, channel: "hidden" })).toMatchObject({ status: "hidden", purchasable: false });
  });
});

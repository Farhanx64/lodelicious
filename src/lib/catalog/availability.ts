/**
 * What a customer may see and buy (PRD INV 05, "Availability policy").
 * Unknown stock or an unapproved price never allows purchase; restockable products stay visible
 * as "Currently unavailable"; known low stock may be bought with a "Low stock" label.
 */
import type { Cents } from "../money";

export type AvailabilityInput = {
  channel: "online" | "in_store_only" | "inquiry_only" | "hidden";
  priceCents: Cents | null;
  priceApproved: boolean;
  stockState: "known" | "unknown";
  stockQuantity: number | null;
  lowStockThreshold: number | null;
  /** Units kept for in-store customers; online can sell only what is above it (D26). */
  onlineReserve: number | null;
};

/** How many units the website may sell: counted stock minus the in-store reserve, never negative. */
export function onlineQuantity(stockQuantity: number, onlineReserve: number | null): number {
  return Math.max(0, stockQuantity - (onlineReserve ?? 0));
}

export type Availability =
  | { status: "available"; purchasable: true; label: null }
  | { status: "low_stock"; purchasable: true; label: "Low stock" }
  | { status: "unavailable"; purchasable: false; label: "Currently unavailable" }
  | { status: "in_store_only"; purchasable: false; label: "Available in our shop" }
  | { status: "inquiry_only"; purchasable: false; label: "Available by inquiry" }
  | { status: "hidden"; purchasable: false; label: null };

export function availabilityOf(input: AvailabilityInput): Availability {
  switch (input.channel) {
    case "hidden":
      return { status: "hidden", purchasable: false, label: null };
    case "in_store_only":
      return { status: "in_store_only", purchasable: false, label: "Available in our shop" };
    case "inquiry_only":
      return { status: "inquiry_only", purchasable: false, label: "Available by inquiry" };
  }
  const unavailable = { status: "unavailable", purchasable: false, label: "Currently unavailable" } as const;
  if (!input.priceApproved || input.priceCents === null) return unavailable;
  if (input.stockState !== "known" || input.stockQuantity === null) return unavailable;
  const sellable = onlineQuantity(input.stockQuantity, input.onlineReserve);
  if (sellable <= 0) return unavailable;
  if (sellable <= (input.lowStockThreshold ?? 0)) return { status: "low_stock", purchasable: true, label: "Low stock" };
  return { status: "available", purchasable: true, label: null };
}

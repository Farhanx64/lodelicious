/**
 * Carrier tracking links for the shipped email (D64). Pure. Framework-free.
 *
 * The tracking number is reduced to letters and digits before it goes into a link, so a pasted number
 * with spaces or dashes still works and nothing typed into the admin can change the URL.
 */
export type Carrier = "usps" | "ups" | "fedex" | "other";

export const CARRIER_NAMES: Record<Carrier, string> = { usps: "USPS", ups: "UPS", fedex: "FedEx", other: "the carrier" };

const PAGES: Record<Exclude<Carrier, "other">, (n: string) => string> = {
  usps: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`,
  ups: (n) => `https://www.ups.com/track?tracknum=${n}`,
  fedex: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
};

export function isCarrier(value: unknown): value is Carrier {
  return value === "usps" || value === "ups" || value === "fedex" || value === "other";
}

/** Letters and digits only, upper case, at most 40 characters; empty when nothing usable is left. */
export function cleanTrackingNumber(value: unknown): string {
  return String(value ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 40);
}

/** The carrier's public tracking page for this number, or null (no number, or "Other"). */
export function trackingUrl(carrier: unknown, trackingNumber: unknown): string | null {
  const n = cleanTrackingNumber(trackingNumber);
  if (!n || !isCarrier(carrier) || carrier === "other") return null;
  return PAGES[carrier](encodeURIComponent(n));
}

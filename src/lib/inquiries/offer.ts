/**
 * The fountain offer as the storefront needs it, read from the event-settings global (D37).
 * Takes a plain document so it is unit-testable without Payload. A global that has never been
 * saved has no values, so every field falls back to the confirmed offer, as in `loadCheckoutContext`.
 */
import type { EventSetting } from "@/payload-types";

import { DEFAULT_FOUNTAIN_TERMS, type FountainTerms } from "./estimate";

export type EventOffer = {
  enabled: boolean;
  terms: FountainTerms;
  /** Terms still unresolved with Lody. Shown to customers only once someone has filled them in. */
  open: { cancellation: string | null; serviceArea: string | null; minimumGuests: number | null; extensions: string | null };
};

const whole = (value: unknown, fallback: number): number => (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : fallback);
const optionalWhole = (value: unknown): number | null => (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null);
const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

export function eventOfferFrom(doc: Partial<EventSetting> | null | undefined): EventOffer {
  const d = DEFAULT_FOUNTAIN_TERMS;
  const saved = Boolean(doc && typeof doc.baseCents === "number");
  const minimumGuests = optionalWhole(doc?.minimumGuests);
  return {
    enabled: doc?.enabled !== false,
    terms: {
      baseCents: whole(doc?.baseCents, d.baseCents),
      includedHours: whole(doc?.includedHours, d.includedHours),
      perGuestCents: whole(doc?.perGuestCents, d.perGuestCents),
      // An unsaved global shows the PRD breakdown; once saved, an empty breakdown stays empty.
      chocolatePerGuestCents: saved ? optionalWhole(doc?.chocolatePerGuestCents) : d.chocolatePerGuestCents,
      fruitPerGuestCents: saved ? optionalWhole(doc?.fruitPerGuestCents) : d.fruitPerGuestCents,
      depositPercentBasisPoints: whole(doc?.depositPercentBasisPoints, d.depositPercentBasisPoints),
    },
    open: {
      cancellation: text(doc?.cancellationTerms),
      serviceArea: text(doc?.serviceArea),
      minimumGuests: minimumGuests && minimumGuests > 0 ? minimumGuests : null,
      extensions: text(doc?.extensionTerms),
    },
  };
}

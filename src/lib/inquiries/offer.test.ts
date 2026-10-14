import { describe, expect, it } from "vitest";

import type { EventSetting } from "@/payload-types";

import { DEFAULT_FOUNTAIN_TERMS } from "./estimate";
import { eventOfferFrom } from "./offer";

describe("eventOfferFrom", () => {
  it("falls back to the confirmed offer for a global that was never saved", () => {
    for (const doc of [null, undefined, {}]) {
      expect(eventOfferFrom(doc)).toEqual({
        enabled: true,
        terms: DEFAULT_FOUNTAIN_TERMS,
        open: { cancellation: null, serviceArea: null, minimumGuests: null, extensions: null },
      });
    }
  });

  it("reads edited prices, the breakdown and the toggle", () => {
    const offer = eventOfferFrom({
      enabled: false,
      baseCents: 30000,
      includedHours: 3,
      perGuestCents: 900,
      chocolatePerGuestCents: 600,
      fruitPerGuestCents: 300,
      depositPercentBasisPoints: 3000,
    } as EventSetting);
    expect(offer.enabled).toBe(false);
    expect(offer.terms).toEqual({ baseCents: 30000, includedHours: 3, perGuestCents: 900, chocolatePerGuestCents: 600, fruitPerGuestCents: 300, depositPercentBasisPoints: 3000 });
  });

  it("keeps a cleared breakdown empty once the settings have been saved", () => {
    const offer = eventOfferFrom({ baseCents: 25000, includedHours: 2, perGuestCents: 850, depositPercentBasisPoints: 2500, chocolatePerGuestCents: null, fruitPerGuestCents: null } as EventSetting);
    expect(offer.terms.chocolatePerGuestCents).toBeNull();
    expect(offer.terms.fruitPerGuestCents).toBeNull();
  });

  it("exposes unresolved terms only when someone has filled them in", () => {
    const blank = eventOfferFrom({ baseCents: 25000, cancellationTerms: "   ", serviceArea: "", minimumGuests: null, extensionTerms: null } as EventSetting);
    expect(blank.open).toEqual({ cancellation: null, serviceArea: null, minimumGuests: null, extensions: null });

    const filled = eventOfferFrom({ baseCents: 25000, cancellationTerms: " Cancel 7 days ahead. ", serviceArea: "Plymouth County", minimumGuests: 20, extensionTerms: "Extra hours by arrangement" } as EventSetting);
    expect(filled.open).toEqual({ cancellation: "Cancel 7 days ahead.", serviceArea: "Plymouth County", minimumGuests: 20, extensions: "Extra hours by arrangement" });
  });

  it("ignores values that are not whole numbers", () => {
    const offer = eventOfferFrom({ baseCents: 250.5, perGuestCents: -1, includedHours: Number.NaN } as EventSetting);
    expect(offer.terms.baseCents).toBe(25000);
    expect(offer.terms.perGuestCents).toBe(850);
    expect(offer.terms.includedHours).toBe(2);
  });
});

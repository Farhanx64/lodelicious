import { describe, expect, it } from "vitest";

import { DEFAULT_FOUNTAIN_TERMS, MAX_GUESTS, fountainEstimate, formatBasisPoints, parseGuests } from "./estimate";

describe("parseGuests", () => {
  it("accepts whole numbers from 1 to 1000, as numbers or digit strings", () => {
    expect(parseGuests(1)).toBe(1);
    expect(parseGuests("1")).toBe(1);
    expect(parseGuests(" 75 ")).toBe(75);
    expect(parseGuests(String(MAX_GUESTS))).toBe(1000);
  });

  it("rejects zero, negatives, fractions, text, exponents and anything over 1000", () => {
    for (const bad of [0, -3, 1001, 12.5, "0", "-4", "12.5", "1e2", "1,000", "ten", "", "  ", null, undefined, NaN, Infinity, {}, [], "00000001001", "100000"]) {
      expect(parseGuests(bad)).toBeNull();
    }
  });
});

describe("fountainEstimate (PRD: $250 + $8.50 x guests)", () => {
  it("works the PRD example out in whole cents", () => {
    // 50 guests: $250.00 + 50 x $8.50 = $675.00
    expect(fountainEstimate(50, DEFAULT_FOUNTAIN_TERMS)).toEqual({ guests: 50, baseCents: 25000, perGuestCents: 850, guestsCents: 42500, totalCents: 67500 });
  });

  it("covers the smallest and largest groups", () => {
    expect(fountainEstimate(1, DEFAULT_FOUNTAIN_TERMS)?.totalCents).toBe(25850);
    expect(fountainEstimate(1000, DEFAULT_FOUNTAIN_TERMS)?.totalCents).toBe(875000);
  });

  it("is always an integer number of cents, whatever the price", () => {
    for (const perGuestCents of [1, 333, 849, 851, 9999]) {
      for (const guests of [1, 3, 7, 33, 999]) {
        const e = fountainEstimate(guests, { baseCents: 12345, perGuestCents })!;
        expect(Number.isInteger(e.totalCents)).toBe(true);
        expect(e.totalCents).toBe(12345 + perGuestCents * guests);
      }
    }
  });

  it("uses the stored terms, not the defaults", () => {
    expect(fountainEstimate(10, { baseCents: 30000, perGuestCents: 900 })?.totalCents).toBe(39000);
  });

  it("returns null for an invalid guest count instead of a made-up price", () => {
    for (const bad of [0, 1001, 2.5, "abc", undefined]) expect(fountainEstimate(bad, DEFAULT_FOUNTAIN_TERMS)).toBeNull();
  });

  it("keeps the confirmed breakdown consistent: chocolate + fruit = per guest", () => {
    expect(DEFAULT_FOUNTAIN_TERMS.chocolatePerGuestCents! + DEFAULT_FOUNTAIN_TERMS.fruitPerGuestCents!).toBe(DEFAULT_FOUNTAIN_TERMS.perGuestCents);
    expect(DEFAULT_FOUNTAIN_TERMS.includedHours).toBe(2);
    expect(DEFAULT_FOUNTAIN_TERMS.depositPercentBasisPoints).toBe(2500);
  });
});

describe("formatBasisPoints", () => {
  it("shows percentages without floats", () => {
    expect(formatBasisPoints(2500)).toBe("25");
    expect(formatBasisPoints(1250)).toBe("12.5");
    expect(formatBasisPoints(1205)).toBe("12.05");
    expect(formatBasisPoints(0)).toBe("0");
    expect(formatBasisPoints(10000)).toBe("100");
  });
});

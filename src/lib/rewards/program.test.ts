import { describe, expect, it } from "vitest";

import type { TaxClass } from "../checkout/tax";
import { affordableOptions, allocateDiscount, configProblem, formatPoints, nextReward, pointsFor, rewardsState, totalsWithDiscount, type RewardsConfig } from "./program";

const complete: RewardsConfig = {
  enabled: true,
  approved: true,
  programName: "Rewards",
  pointsPerDollar: 1,
  welcomePoints: 0,
  options: [
    { id: "b", pointsRequired: 200, discountCents: 1000 },
    { id: "a", pointsRequired: 100, discountCents: 500 },
  ],
  terms: "Points have no cash value.",
};

describe("rewardsState (D45)", () => {
  it("is off until switched on, complete and approved; staging shows an unapproved program as a draft", () => {
    expect(rewardsState({ ...complete, enabled: false }, { APP_ENV: "staging" })).toMatchObject({ active: false });
    expect(rewardsState(complete, {})).toEqual({ active: true, draft: false, reason: null });
    expect(rewardsState({ ...complete, approved: false }, {})).toMatchObject({ active: false, reason: expect.stringContaining("approved") });
    expect(rewardsState({ ...complete, approved: false }, { APP_ENV: "staging" })).toEqual({ active: true, draft: true, reason: null });
    expect(rewardsState({ ...complete, approved: false }, { APP_ENV: "prod" })).toMatchObject({ active: false });
    expect(rewardsState({ ...complete, pointsPerDollar: null }, { APP_ENV: "test" })).toMatchObject({ active: false, reason: expect.stringContaining("points a dollar") });
    expect(rewardsState({ ...complete, options: [] }, {})).toMatchObject({ active: false, reason: "Add at least one reward." });
  });

  it("refuses settings that don't make sense", () => {
    expect(configProblem({ ...complete, pointsPerDollar: 1.5 })).toMatch(/whole number/);
    expect(configProblem({ ...complete, pointsPerDollar: 101 })).toMatch(/1 to 100/);
    expect(configProblem({ ...complete, welcomePoints: -1 })).toMatch(/Welcome/);
    expect(configProblem({ ...complete, options: [{ id: "x", pointsRequired: 0, discountCents: 100 }] })).toMatch(/points/);
    expect(configProblem({ ...complete, options: [{ id: "x", pointsRequired: 10, discountCents: 0 }] })).toMatch(/amount off/);
    expect(configProblem({ ...complete, options: [complete.options[0], { id: "y", pointsRequired: 200, discountCents: 50 }] })).toMatch(/same number/);
    expect(configProblem(complete)).toBeNull();
  });
});

describe("points", () => {
  it("earns per whole dollar, rounded down, on what was paid before tax", () => {
    expect(pointsFor(1999, 1)).toBe(19);
    expect(pointsFor(2000, 2)).toBe(40);
    expect(pointsFor(99, 5)).toBe(4);
    expect(pointsFor(0, 5)).toBe(0);
    expect(pointsFor(-500, 5)).toBe(0);
    expect(pointsFor(1000, null)).toBe(0);
  });

  it("offers only rewards the balance covers and the subtotal can absorb, cheapest first", () => {
    expect(affordableOptions(complete.options, 250, 5000).map((o) => o.id)).toEqual(["a", "b"]);
    expect(affordableOptions(complete.options, 150, 5000).map((o) => o.id)).toEqual(["a"]);
    expect(affordableOptions(complete.options, 250, 800).map((o) => o.id)).toEqual(["a"]);
    expect(affordableOptions(complete.options, 99, 5000)).toEqual([]);
  });

  it("names the next reward still out of reach", () => {
    expect(nextReward(complete.options, 40)).toEqual({ option: complete.options[1], pointsToGo: 60 });
    expect(nextReward(complete.options, 150)).toEqual({ option: complete.options[0], pointsToGo: 50 });
    expect(nextReward(complete.options, 200)).toBeNull();
  });

  it("formats points", () => {
    expect(formatPoints(1)).toBe("1 point");
    expect(formatPoints(1200)).toBe("1,200 points");
  });
});

describe("allocateDiscount", () => {
  it("splits a discount in proportion, in whole cents, adding up exactly", () => {
    expect(allocateDiscount([1000, 1000], 500)).toEqual([250, 250]);
    expect(allocateDiscount([1000, 2000], 100)).toEqual([33, 67]);
    expect(allocateDiscount([333, 333, 334], 100)).toEqual([33, 33, 34]);
    for (const [amounts, d] of [
      [[1, 1, 1], 2],
      [[999, 1, 5], 7],
      [[425, 425, 1299], 500],
    ] as [number[], number][]) {
      const shares = allocateDiscount(amounts, d);
      expect(shares.reduce((s, x) => s + x, 0)).toBe(d);
      shares.forEach((x, i) => expect(x).toBeLessThanOrEqual(amounts[i]));
    }
  });

  it("never takes more than the lines are worth", () => {
    expect(allocateDiscount([300, 200], 1000)).toEqual([300, 200]);
    expect(allocateDiscount([], 100)).toEqual([]);
    expect(allocateDiscount([500], 0)).toEqual([0]);
  });
});

describe("totalsWithDiscount", () => {
  const tax: TaxClass = { id: "1", name: "MA", rateBasisPoints: 625, approved: true };
  const none = null;

  it("takes the discount off before tax, line by line", () => {
    const t = totalsWithDiscount(
      [
        { amountCents: 2000, taxClass: tax },
        { amountCents: 2000, taxClass: none },
      ],
      1000,
    );
    expect(t).toEqual({
      discountCents: 1000,
      perLineDiscount: [500, 500],
      perLineTax: [94, 0],
      subtotalCents: 4000,
      taxCents: 94,
      totalCents: 3094,
      taxApproved: false,
    });
  });

  it("matches the undiscounted totals when there is no reward", () => {
    expect(totalsWithDiscount([{ amountCents: 1000, taxClass: tax }], 0)).toMatchObject({ discountCents: 0, taxCents: 63, totalCents: 1063, taxApproved: true });
  });
});

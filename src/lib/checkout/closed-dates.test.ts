import { describe, expect, it } from "vitest";

import { defaultClosedDates, laborDay } from "./closed-dates";
import { availableSlots, type PickupSettings } from "./pickup";

const dates = (now: string, options?: Parameters<typeof defaultClosedDates>[1]) => defaultClosedDates(new Date(now), options).map((c) => c.date);

describe("laborDay", () => {
  it("is the first Monday of September", () => {
    expect(laborDay(2026)).toBe("2026-09-07");
    expect(laborDay(2027)).toBe("2027-09-06");
    expect(laborDay(2028)).toBe("2028-09-04");
    expect(laborDay(2029)).toBe("2029-09-03");
    expect(laborDay(2030)).toBe("2030-09-02");
    // September 1 itself is a Monday in 2025 and 2031.
    expect(laborDay(2025)).toBe("2025-09-01");
    expect(laborDay(2031)).toBe("2031-09-01");
  });
});

describe("defaultClosedDates (A07, PRD FUL 01)", () => {
  it("lists Christmas, New Year's Day and Labor Day for the next 18 months", () => {
    expect(defaultClosedDates(new Date("2026-10-06T12:00:00Z"))).toEqual([
      { date: "2026-12-25", label: "Christmas Day" },
      { date: "2027-01-01", label: "New Year's Day" },
      { date: "2027-09-06", label: "Labor Day" },
      { date: "2027-12-25", label: "Christmas Day" },
      { date: "2028-01-01", label: "New Year's Day" },
    ]);
  });

  it("includes today when today is a closed day, and drops yesterday", () => {
    expect(dates("2026-12-25T15:00:00Z")[0]).toBe("2026-12-25");
    expect(dates("2026-12-26T15:00:00Z")[0]).toBe("2027-01-01");
  });

  it("uses the shop's calendar day, not UTC (late evening in New York is already the next UTC day)", () => {
    // 2026-12-25 22:00 in New York is 2026-12-26 03:00 UTC: still Christmas for the shop.
    expect(dates("2026-12-26T03:00:00Z")[0]).toBe("2026-12-25");
  });

  it("stops at the horizon", () => {
    expect(dates("2026-10-06T12:00:00Z", { months: 3 })).toEqual(["2026-12-25", "2027-01-01"]);
    expect(dates("2026-10-06T12:00:00Z", { months: 2 })).toEqual([]);
  });

  it("is sorted, without duplicates, and every date is valid YYYY-MM-DD", () => {
    const list = dates("2026-02-14T12:00:00Z", { months: 40 });
    expect(list).toEqual([...new Set(list)].sort());
    for (const d of list) expect(new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10)).toBe(d);
  });

  it("makes checkout stop offering those days", () => {
    const settings: PickupSettings = {
      hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, open: "11:00", close: "17:00" })),
      slotMinutes: 60,
      leadTimeHours: 24,
      daysAhead: 14,
      closedDates: [],
    };
    const now = new Date("2026-12-20T15:00:00Z");
    const offered = (closedDates: string[]) => new Set(availableSlots({ ...settings, closedDates }, now).map((s) => s.date));
    expect(offered([])).toContain("2026-12-25");
    expect(offered([])).toContain("2027-01-01");
    const closed = defaultClosedDates(now).map((c) => c.date);
    expect(offered(closed)).not.toContain("2026-12-25");
    expect(offered(closed)).not.toContain("2027-01-01");
    expect(offered(closed)).toContain("2026-12-24");
  });
});

import { describe, expect, it } from "vitest";

import { nextSequence, suffixOf } from "./numbering";
import { formatNumber } from "./order";

describe("order and reservation numbers (A02)", () => {
  it("starts at 1001 and goes one above the highest ever used", () => {
    expect(formatNumber("SP", nextSequence(null))).toBe("SP-1001");
    expect(formatNumber("SP", nextSequence(1005))).toBe("SP-1006");
    expect(formatNumber("SPR", nextSequence(1099))).toBe("SPR-1100");
  });

  it("is not a count: deleting an early order leaves the next number clear of the others", () => {
    // SP-1001 was deleted, so 1002..1005 remain: four orders, but the next must be 1006, not 1005.
    const remaining = ["SP-1002", "SP-1003", "SP-1004", "SP-1005"];
    const highest = Math.max(...remaining.map((n) => suffixOf(n, "SP")!));
    expect(formatNumber("SP", nextSequence(highest))).toBe("SP-1006");
    // A count-based number would have been SP-1005, which already exists.
    expect(formatNumber("SP", remaining.length + 1)).toBe("SP-1005");
  });

  it("skips ahead after a collision, and sorts numerically past 9999", () => {
    expect(formatNumber("SP", nextSequence(1005, 1))).toBe("SP-1007");
    expect(formatNumber("SP", nextSequence(9999))).toBe("SP-10000");
  });

  it("reads only its own prefix", () => {
    expect(suffixOf("SP-1042", "SP")).toBe(1042);
    expect(suffixOf("SPR-1042", "SP")).toBeNull();
    expect(suffixOf("SP-10x", "SP")).toBeNull();
  });
});

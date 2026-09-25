import { describe, expect, it } from "vitest";

import { formatCents, multiplyCents, parseCents, sumCents } from "./money";

describe("parseCents", () => {
  it.each([
    ["19.95", 1995],
    ["37.95", 3795],
    ["$139.95", 13995],
    ["$1,299.00", 129900],
    ["8.5", 850],
    ["25", 2500],
    ["-4.25", -425],
    ["0.30", 30],
  ])("parses %s without floats", (input, expected) => {
    expect(parseCents(input)).toBe(expected);
  });

  it("rejects more than two decimals and garbage", () => {
    expect(() => parseCents("29.955")).toThrow(RangeError);
    expect(() => parseCents("twenty")).toThrow(RangeError);
    expect(() => parseCents("")).toThrow(RangeError);
  });
});

describe("arithmetic", () => {
  it("matches the PRD budget example: $100 - $29.95 packaging = $70.05", () => {
    const remaining = parseCents("100.00") - parseCents("29.95");
    expect(remaining).toBe(7005);
    expect(formatCents(remaining)).toBe("$70.05");
  });

  it("does not drift where floats would (0.1 + 0.2)", () => {
    expect(sumCents([10, 20])).toBe(30);
    expect(multiplyCents(425, 3)).toBe(1275);
  });

  it("rejects non-integer inputs", () => {
    expect(() => sumCents([10.5])).toThrow(RangeError);
    expect(() => multiplyCents(425, 1.5)).toThrow(RangeError);
  });

  it("formats", () => {
    expect(formatCents(199999)).toBe("$1,999.99");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(-425)).toBe("-$4.25");
  });
});

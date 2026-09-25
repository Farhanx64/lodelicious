/**
 * Guards the verbatim source evidence against accidental edits (PRD AC 01).
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseCsvRecords } from "@/src/lib/csv";
import { readSourceRows } from "@/src/lib/source-files";

const read = (file: string) =>
  parseCsvRecords(fs.readFileSync(path.resolve("data/source", file), "utf8"));

describe("source evidence", () => {
  it("matches the PRD appendix row counts (20 + 19 + 12 overlapping observations)", () => {
    const rows = readSourceRows();
    expect(rows.filter((r) => r.source === "clover_public")).toHaveLength(20);
    expect(rows.filter((r) => r.source === "price_list_screenshot")).toHaveLength(19);
    expect(rows.filter((r) => r.source === "doordash")).toHaveLength(12);
  });

  it("has unique refs and integer-cent prices", () => {
    const rows = readSourceRows();
    expect(new Set(rows.map((r) => r.ref)).size).toBe(rows.length);
    for (const r of rows) expect(Number.isSafeInteger(r.sourcePriceCents)).toBe(true);
  });

  it("keeps the basket chart counts, including large sympathy 13–16", () => {
    const chart = Object.fromEntries(read("basket-chart.csv").map((r) => [r.code, [r.min_items, r.max_items]]));
    expect(Object.keys(chart)).toHaveLength(9);
    expect(chart.small).toEqual(["6", "8"]);
    expect(chart.medium).toEqual(["10", "12"]);
    expect(chart.large).toEqual(["12", "14"]);
    expect(chart.extra_large).toEqual(["18", "20"]);
    expect(chart.large_sympathy).toEqual(["13", "16"]);
  });
});

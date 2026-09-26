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
  it("matches the source row counts (PRD appendices 20 + 19 + 12, owner cards 15, supplier specs 7)", () => {
    const rows = readSourceRows();
    expect(rows.filter((r) => r.source === "clover_public")).toHaveLength(20);
    expect(rows.filter((r) => r.source === "price_list_screenshot")).toHaveLength(19);
    expect(rows.filter((r) => r.source === "doordash")).toHaveLength(12);
    expect(rows.filter((r) => r.source === "owner_product_card")).toHaveLength(15);
    expect(rows.filter((r) => r.source === "supplier_spec")).toHaveLength(7);
  });

  it("has unique refs and integer-cent prices", () => {
    const rows = readSourceRows();
    expect(new Set(rows.map((r) => r.ref)).size).toBe(rows.length);
    for (const r of rows) {
      if (r.sourcePriceCents !== null) expect(Number.isSafeInteger(r.sourcePriceCents)).toBe(true);
    }
    // Only the bassinet (sold inside the Baby White gift) has no observed price.
    expect(rows.filter((r) => r.sourcePriceCents === null).map((r) => r.ref)).toEqual(["S01"]);
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

/**
 * Guards the verbatim source evidence against accidental edits (PRD AC 01).
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { GIFT_BASKET_CATEGORY, GIFT_BASKET_GROUPS } from "@/src/lib/catalog/gift-baskets";
import { loadCatalogSeed } from "@/src/lib/catalog/seed";
import { parseCsvRecords } from "@/src/lib/csv";
import { readSourceRows } from "@/src/lib/source-files";

const read = (file: string) =>
  parseCsvRecords(fs.readFileSync(path.resolve("data/source", file), "utf8"));

describe("source evidence", () => {
  it("matches the source row counts (PRD appendices 20 + 19 + 12, owner cards 15, supplier specs 7, Clover export 105)", () => {
    const rows = readSourceRows();
    expect(rows.filter((r) => r.source === "clover_public")).toHaveLength(20);
    expect(rows.filter((r) => r.source === "price_list_screenshot")).toHaveLength(19);
    expect(rows.filter((r) => r.source === "doordash")).toHaveLength(12);
    expect(rows.filter((r) => r.source === "owner_product_card")).toHaveLength(15);
    expect(rows.filter((r) => r.source === "supplier_spec")).toHaveLength(7);
    // Lody's full Clover inventory export (2026-09-30): every item has a Clover ID, none has a stock count.
    const exported = rows.filter((r) => r.source === "clover_export");
    expect(exported).toHaveLength(105);
    expect(exported.every((r) => /^clover_id=[0-9A-Z]{13};/.test(r.sourceNotes ?? ""))).toBe(true);
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

/** Curated baskets: Clover public storefront row (price) and owner chart row (contents, counts). */
const CURATED: Record<string, { chart: string; ref: string }> = {
  "small-gift-basket": { chart: "small", ref: "C17" },
  "medium-gift-basket": { chart: "medium", ref: "C13" },
  "large-gift-basket": { chart: "large", ref: "C09" },
  "extra-large-gift-basket": { chart: "extra_large", ref: "C07" },
  "large-birthday-basket": { chart: "large_birthday", ref: "C08" },
  "large-savory-basket": { chart: "large_savory", ref: "C10" },
  "small-sympathy-basket": { chart: "small_sympathy", ref: "C19" },
  "medium-sympathy-basket": { chart: "medium_sympathy", ref: "C15" },
  "large-sympathy-basket": { chart: "large_sympathy", ref: "C12" },
};

describe("catalog seed against the source evidence", () => {
  const { seed } = loadCatalogSeed();
  const sourceRows = new Map(readSourceRows().map((r) => [r.ref, r]));
  const chart = new Map(read("basket-chart.csv").map((r) => [r.code, r]));
  const baskets = seed.products.filter((p) => p.category === GIFT_BASKET_CATEGORY);

  it("links every product only to source records that exist (a typo would silently link nothing)", () => {
    for (const p of seed.products) {
      for (const ref of p.sources ?? []) expect(sourceRows.has(ref), `${p.slug}: unknown source ${ref}`).toBe(true);
    }
  });

  it("never puts a nut-free claim in a title or slug, because 'Nut Free' is a source title (PRD)", () => {
    for (const p of seed.products) expect(`${p.title} ${p.slug}`, p.slug).not.toMatch(/nut[\s-]?free/i);
    // C14 "Medium Nut Free Basket" stays out of the catalog (D38) but its source row is kept.
    expect(sourceRows.get("C14")).toMatchObject({ sourceName: "Medium Nut Free Basket", sourcePriceCents: 9895 });
    expect(seed.products.some((p) => p.sources?.includes("C14"))).toBe(false);
  });

  it("seeds exactly the nine curated baskets, all named in the page's group map", () => {
    expect(baskets.map((p) => p.slug).sort()).toEqual(Object.keys(CURATED).sort());
    expect(GIFT_BASKET_GROUPS.flatMap((g) => g.slugs).sort()).toEqual(Object.keys(CURATED).sort());
    expect(seed.categories.map((c) => c.slug)).toContain(GIFT_BASKET_CATEGORY);
  });

  it("takes each basket's price from its Clover public storefront row, unapproved and inquiry-only (D38)", () => {
    for (const p of baskets) {
      const { ref } = CURATED[p.slug];
      const row = sourceRows.get(ref)!;
      expect(row.source, ref).toBe("clover_public");
      expect(row.observedOn, ref).toBe("2026-09-22");
      expect(row.sourceNotes, ref).toMatch(/curated; price includes packaging per owner/);
      expect(p.sources, p.slug).toEqual([ref]);
      expect(p.priceCents, p.slug).toBe(row.sourcePriceCents);
      expect(p.priceApproved, p.slug).toBe(false);
      expect(p.channel, p.slug).toBe("inquiry_only");
      expect(p.priceSource, p.slug).toContain(`2026-09-22 (${ref})`);
      expect(p.basketEligible ?? false, p.slug).toBe(false);
      expect(p.images ?? [], p.slug).toEqual([]);
      expect(p.allergen, p.slug).toBeUndefined();
    }
  });

  it("takes each basket's contents, item count and basket size only from the owner's chart", () => {
    for (const p of baskets) {
      const row = chart.get(CURATED[p.slug].chart)!;
      expect(p.title, p.slug).toBe(row.source_name);
      expect(p.sizeLabel, p.slug).toBe(`${row.min_items}–${row.max_items} items · ${row.basket_size_in.replace("-", "–")} in basket`);
      expect(p.shortDescription, p.slug).toMatch(/^Typically includes /);
      const text = (p.shortDescription ?? "").toLowerCase();
      for (const item of row.contents.split(";").map((i) => i.trim().toLowerCase())) expect(text, `${p.slug}: ${item}`).toContain(item);
    }
  });
});

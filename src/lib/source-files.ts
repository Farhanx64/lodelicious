import fs from "node:fs";
import path from "node:path";

import { parseCsvRecords } from "./csv";
import type { SourceRow } from "./source-import";

/** The verbatim evidence files in data/source and the source each one represents. */
export const SOURCE_FILES = [
  { file: "clover-public-2026-09-22.csv", source: "clover_public" },
  { file: "price-list-screenshot.csv", source: "price_list_screenshot" },
  { file: "doordash-2026-09-25.csv", source: "doordash" },
] as const;

export function readSourceRows(dataDir = path.resolve(process.cwd(), "data/source")): SourceRow[] {
  return SOURCE_FILES.flatMap(({ file, source }) =>
    parseCsvRecords(fs.readFileSync(path.join(dataDir, file), "utf8")).map((r) => {
      if (r.source !== source) {
        throw new Error(`${file} ${r.ref}: source column "${r.source}" does not match file`);
      }
      if (!/^\d+$/.test(r.source_price_cents)) {
        throw new Error(`${file} ${r.ref}: price "${r.source_price_cents}" is not integer cents`);
      }
      return {
        ref: r.ref,
        source,
        sourceName: r.source_name,
        sourceBrand: r.source_brand || undefined,
        sourcePriceCents: Number(r.source_price_cents),
        observedOn: r.observed_on || undefined,
        sourceNotes: r.notes || undefined,
      };
    }),
  );
}

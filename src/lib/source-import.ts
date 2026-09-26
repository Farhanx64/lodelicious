import type { Payload } from "payload";

import type { SourceRecord } from "@/payload-types";

export type SourceRow = {
  ref: string;
  source: SourceRecord["source"];
  sourceName: string;
  sourceBrand?: string;
  sourcePriceCents: number | null;
  observedOn?: string;
  sourceNotes?: string;
};

export type ImportReport = {
  created: string[];
  unchanged: string[];
  /** Existing ref whose evidence differs from the file: never overwritten silently (PRD CAT 02). */
  conflicts: { ref: string; fields: string[] }[];
};

const EVIDENCE_FIELDS = ["source", "sourceName", "sourceBrand", "sourcePriceCents", "observedOn", "sourceNotes"] as const;

function normalise(field: (typeof EVIDENCE_FIELDS)[number], value: unknown): unknown {
  if (value === undefined || value === null || value === "") return null;
  if (field === "observedOn") return String(value).slice(0, 10);
  return value;
}

/**
 * Idempotent, restartable import keyed by `ref`. New refs are created as "unreviewed";
 * identical refs are skipped; differing refs are reported, not overwritten.
 */
export async function importSourceRecords(payload: Payload, rows: readonly SourceRow[]): Promise<ImportReport> {
  const report: ImportReport = { created: [], unchanged: [], conflicts: [] };

  for (const row of rows) {
    if (row.sourcePriceCents !== null && (!Number.isSafeInteger(row.sourcePriceCents) || row.sourcePriceCents < 0)) {
      throw new RangeError(`${row.ref}: price must be non-negative integer cents`);
    }
    const existing = await payload.find({
      collection: "source-records",
      where: { ref: { equals: row.ref } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    const current = existing.docs[0];

    if (!current) {
      await payload.create({
        collection: "source-records",
        data: {
          ...row,
          observedOn: row.observedOn ? `${row.observedOn}T00:00:00.000Z` : null,
          disposition: "unreviewed",
        },
        overrideAccess: true,
      });
      report.created.push(row.ref);
      continue;
    }

    const differing = EVIDENCE_FIELDS.filter(
      (field) => normalise(field, current[field]) !== normalise(field, row[field]),
    );
    if (differing.length === 0) {
      report.unchanged.push(row.ref);
    } else {
      report.conflicts.push({ ref: row.ref, fields: differing });
    }
  }

  return report;
}

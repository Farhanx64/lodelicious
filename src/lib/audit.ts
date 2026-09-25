/**
 * Field-level change detection for the commercial audit trail (PRD OPS 03).
 */

export type FieldChange = { field: string; before: unknown; after: unknown };

function stable(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

/** Changes to `fields` between two documents. A create compares against an empty document. */
export function diffFields(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
  fields: readonly string[],
): FieldChange[] {
  return fields
    .filter((field) => stable(before?.[field]) !== stable(after[field]))
    .map((field) => ({ field, before: before?.[field] ?? null, after: after[field] ?? null }));
}

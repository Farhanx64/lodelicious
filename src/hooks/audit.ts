import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from "payload";

import { diffFields } from "../lib/audit";

/**
 * Append an audit-log row for each create/update that changes one of `fields`.
 *
 * This runs in the same request as the change, but NOT in the same database transaction: the
 * SQLite adapter is built without `transactionOptions` (D40), so the change and its audit row are
 * two separate writes. A failure between them can leave a change without its row (D42).
 */
export function auditCollection(fields: readonly string[]): CollectionAfterChangeHook {
  return async ({ collection, doc, previousDoc, operation, req }) => {
    const changes = diffFields(operation === "create" ? undefined : previousDoc, doc, fields);
    if (changes.length === 0) return doc;
    await req.payload.create({
      collection: "audit-log",
      data: {
        action: operation,
        target: collection.slug,
        targetId: String(doc.id),
        user: req.user?.id ?? null,
        changes,
      },
      overrideAccess: true,
      req,
    });
    return doc;
  };
}

export function auditGlobal(fields: readonly string[]): GlobalAfterChangeHook {
  return async ({ global, doc, previousDoc, req }) => {
    const changes = diffFields(previousDoc, doc, fields);
    if (changes.length === 0) return doc;
    await req.payload.create({
      collection: "audit-log",
      data: {
        action: "update",
        target: global.slug,
        targetId: global.slug,
        user: req.user?.id ?? null,
        changes,
      },
      overrideAccess: true,
      req,
    });
    return doc;
  };
}

const LABEL_FIELDS = ["title", "name", "number", "email", "slug", "filename"] as const;

/**
 * Append an audit-log row when a document is deleted (A20): who, which collection, which record,
 * and the last values of the audited `fields`. A delete is always logged, even when none of those
 * fields held a value. Like {@link auditCollection}, it is a separate write, not part of the
 * delete's transaction.
 */
export function auditDelete(fields: readonly string[]): CollectionAfterDeleteHook {
  return async ({ collection, doc, id, req }) => {
    const record = doc as Record<string, unknown>;
    const label = LABEL_FIELDS.map((f) => record[f]).find((v) => typeof v === "string" && v.length > 0);
    const changes = [
      ...(label ? [{ field: "record", before: label, after: null }] : []),
      ...diffFields(record, {}, fields),
    ];
    await req.payload.create({
      collection: "audit-log",
      data: {
        action: "delete",
        target: collection.slug,
        targetId: String(id ?? doc.id),
        user: req.user?.id ?? null,
        changes,
      },
      overrideAccess: true,
      req,
    });
    return doc;
  };
}

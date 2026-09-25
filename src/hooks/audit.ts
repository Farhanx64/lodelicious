import type { CollectionAfterChangeHook, GlobalAfterChangeHook } from "payload";

import { diffFields } from "../lib/audit";

/**
 * Append an audit-log row for each create/update that changes one of `fields`.
 * Runs inside the same request (and database transaction) as the change itself.
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

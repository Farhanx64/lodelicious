/**
 * Finds records that owe an email and sends it (D44). The body of `scripts/send-pending-emails.ts`, kept in
 * `src/lib` so a test can run it against a test database.
 */
import type { Payload, Where } from "payload";

import type { EnvLike } from "../app-env";
import type { RecordKind } from "./due";
import { sendDueEmails } from "./notify";

const BATCH = 200;

const empty = (field: string): Where => ({ [`emails.${field}`]: { exists: false } });

/** Records that might owe an email. The exact decision is `dueEmails`, applied again to each record. */
function candidates(collection: RecordKind): Where {
  if (collection === "inquiries") return { or: [empty("confirmationSentAt"), empty("staffNotifiedAt")] };
  const paid = collection === "orders" ? ["paid"] : ["deposit_paid", "paid_in_full"];
  const status = { paymentStatus: { in: paid } };
  return {
    or: [
      { and: [status, { or: [empty("confirmationSentAt"), empty("staffNotifiedAt")] }] },
      { and: [{ paymentStatus: { equals: "unknown" } }, empty("unknownNotifiedAt")] },
      { and: [status, { stockStatus: { equals: "needs_attention" } }, empty("attentionNotifiedAt")] },
    ],
  };
}

export type PendingReport = { records: number; sent: number; failed: number };

export async function sendPendingEmails(payload: Payload, opts: { env?: EnvLike; now?: Date } = {}): Promise<PendingReport> {
  const report: PendingReport = { records: 0, sent: 0, failed: 0 };
  for (const collection of ["orders", "reservations", "inquiries"] as const) {
    const { docs } = await payload.find({ collection, where: candidates(collection), limit: BATCH, depth: 0, sort: "createdAt", overrideAccess: true });
    for (const doc of docs) {
      const r = await sendDueEmails(payload, collection, doc, opts);
      if (r.sent.length || r.failed.length) report.records++;
      report.sent += r.sent.length;
      report.failed += r.failed.length;
    }
  }
  return report;
}

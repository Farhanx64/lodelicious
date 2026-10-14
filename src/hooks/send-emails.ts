import type { CollectionAfterChangeHook } from "payload";

import { sendDueEmails } from "../lib/email/notify";
import type { RecordKind } from "../lib/email/due";

/**
 * Sends the transactional emails a saved record owes (D44): when an order or reservation is paid, when a
 * payment is left unknown, when a paid record's stock needs attention, and when an inquiry arrives.
 *
 * It decides from the saved state, not from the change, so staff marking an "unknown" payment as paid
 * sends the confirmation too, and a repeated save sends nothing (the sent markers, claimed atomically in
 * `sendDueEmails`). It never throws: an email problem is logged and must not fail the order, the payment
 * or the staff member's save.
 */
export function sendRecordEmails(collection: RecordKind): CollectionAfterChangeHook {
  return async ({ doc, req }) => {
    try {
      await sendDueEmails(req.payload, collection, doc);
    } catch (e) {
      console.error(`[email] ${collection}: unexpected error, ignored: ${e instanceof Error ? e.message.slice(0, 200) : "unknown"}`);
    }
    return doc;
  };
}

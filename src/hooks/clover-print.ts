import type { CollectionAfterChangeHook } from "payload";

import { printOrderToClover, type PrintCollection } from "../lib/clover/order-print";

/**
 * Puts a paid web order or reservation on Lody's Clover device (D61). Off unless `CLOVER_ORDER_PRINT=on`.
 *
 * Decides from the saved state (paid, recent, not canceled), so staff marking an unknown payment paid
 * prints it too, and a repeated save prints nothing (a per-record `sync-jobs` row). It never throws: a
 * Clover problem is logged and retried by the send-pending-emails job, and must never fail the order,
 * the payment or a staff member's save.
 */
export function printPaidToClover(collection: PrintCollection): CollectionAfterChangeHook {
  return async ({ doc, req }) => {
    try {
      await printOrderToClover(req.payload, collection, doc);
    } catch (e) {
      console.error(`[clover-print] ${collection}: unexpected error, ignored: ${e instanceof Error ? e.message.slice(0, 200) : "unknown"}`);
    }
    return doc;
  };
}

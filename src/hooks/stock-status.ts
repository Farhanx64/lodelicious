import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook } from "payload";

import { releaseHolds } from "../lib/inventory/ledger";

/**
 * Staff may only mark a paid record whose stock could not be taken as resolved. Every other
 * change to `stockStatus` is made by checkout code, which runs without a user.
 */
export const guardStockStatus: CollectionBeforeChangeHook = ({ data, originalDoc, req, operation }) => {
  if (operation !== "update" || !req.user) return data;
  const before = originalDoc?.stockStatus ?? "none";
  const after = data.stockStatus;
  if (after === undefined || after === before) return data;
  if (before === "needs_attention" && after === "resolved") return data;
  throw new APIError('Stock status is set by checkout. You can only change "Needs attention" to "Resolved" once you have fixed the stock by hand.', 400, undefined, true);
};

/**
 * Cancelling a record that is still waiting for payment lets go of its hold. It never restocks:
 * stock that was already taken goes back only through an explicit restock under Stock adjustments.
 */
export function releaseHoldOnCancel(statusField: "fulfillmentStatus" | "reservationStatus"): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, collection, req, operation }) => {
    if (operation !== "update") return doc;
    if (doc[statusField] !== "canceled" || previousDoc?.[statusField] === "canceled") return doc;
    if (doc.stockStatus !== "held" || !doc.stockOwner) return doc;
    await releaseHolds(req.payload, String(doc.stockOwner), new Date());
    await req.payload.update({ collection: collection.slug as "orders" | "reservations", id: doc.id, data: { stockStatus: "released" }, overrideAccess: true, req: undefined });
    return doc;
  };
}

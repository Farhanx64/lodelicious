import crypto from "node:crypto";

import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook, type GlobalBeforeChangeHook } from "payload";

import { hasRole, type Role } from "../access/roles";
import { configProblem } from "../lib/rewards/program";
import { entryKey, NotEnoughPoints, postEntry } from "../lib/rewards/ledger";
import { settleRecordRewards } from "../lib/rewards/settle";

function fail(message: string, status = 400): never {
  throw new APIError(message, status, undefined, true);
}

type MaybeUser = { id?: number | string; roles?: Role[] | null } | null | undefined;

/**
 * Applies a staff points adjustment when it is saved (D47), like stock adjustments (D40): the ledger
 * entry and the new balance are written first, in one atomic step, and a refused change (it would take
 * the balance below zero) throws, so no adjustment row is saved either.
 */
export const applyPointsAdjustment: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== "create") return data;
  const user = req.user as MaybeUser;
  if (!hasRole(user, "owner", "manager")) fail("Only the owner or a manager can change points.", 403);
  const memberId = Number(typeof data.member === "object" && data.member ? (data.member as { id: unknown }).id : data.member);
  if (!Number.isSafeInteger(memberId)) fail("Choose the member.");
  const points = data.points;
  if (typeof points !== "number" || !Number.isSafeInteger(points) || points === 0) fail("Enter the change as a whole number other than 0, such as 50 or -20.");
  const note = String(data.note ?? "").trim();
  if (!note) fail("Please say why, so the member's history makes sense later.");
  const requestId = crypto.randomUUID();
  const userId = Number(user?.id);
  try {
    const result = await postEntry(req.payload, {
      memberId,
      kind: "adjust",
      points,
      key: entryKey.adjust(requestId),
      reference: `adjustment ${requestId.slice(0, 8)}`,
      userId: Number.isSafeInteger(userId) ? userId : null,
      note,
    });
    return { ...data, member: memberId, note, user: Number.isSafeInteger(userId) ? userId : null, requestId, balanceAfter: result.applied ? result.balance : null };
  } catch (e) {
    if (e instanceof NotEnoughPoints) fail("That would take the member's points below zero.");
    throw e;
  }
};

type StoredSettings = {
  enabled?: boolean | null;
  approved?: boolean | null;
  pointsPerDollar?: number | null;
  welcomePoints?: number | null;
  rewards?: { pointsRequired?: number | null; discountCents?: number | null }[] | null;
  terms?: string | null;
  programName?: string | null;
};

/** The parts of the settings a customer relies on: changing any of them needs the owner's approval again. */
const termsOf = (s: StoredSettings) =>
  JSON.stringify([
    s.programName?.trim() ?? "",
    s.pointsPerDollar ?? null,
    s.welcomePoints ?? 0,
    (s.rewards ?? []).map((r) => [r.pointsRequired ?? null, r.discountCents ?? null]),
    s.terms?.trim() ?? "",
  ]);

/**
 * Like policies (D39): Faisal can prepare the program, but only Lody approves it, and changing the
 * earn rate, rewards, welcome points or terms of an approved program clears the approval unless the
 * owner saved it. Switching it on, or approving it, needs complete settings and terms text.
 */
export const guardRewardsSettings: GlobalBeforeChangeHook = ({ data, originalDoc, req }) => {
  const owner = hasRole(req.user as MaybeUser, "owner");
  const before = (originalDoc ?? {}) as StoredSettings;
  // Fields the user may not change (Approved, for a manager) arrive as undefined: keep the stored value.
  const given = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as StoredSettings;
  const merged = { ...before, ...given };
  let approved = merged.approved === true;
  if (!owner) {
    if (approved && before.approved !== true) fail("Only the owner can approve the rewards program.", 403);
    if (termsOf(merged) !== termsOf(before)) approved = false;
  }
  const config = {
    pointsPerDollar: merged.pointsPerDollar ?? null,
    welcomePoints: merged.welcomePoints ?? 0,
    options: (merged.rewards ?? []).map((r, i) => ({ id: String(i), pointsRequired: Number(r.pointsRequired), discountCents: Number(r.discountCents) })),
  };
  if (merged.enabled || approved) {
    const problem = configProblem(config);
    if (problem) fail(problem);
  }
  if (approved && !merged.terms?.trim()) fail("Write the terms customers will see before approving the program.");
  return { ...data, approved };
};

/** Earn, give back and take back points as an order or reservation's payment changes (D47). Never fails the save. */
export function settleRewardsAfterChange(collection: "orders" | "reservations"): CollectionAfterChangeHook {
  return async ({ doc, req }) => {
    try {
      await settleRecordRewards(req.payload, collection, doc);
    } catch (e) {
      console.error(`[rewards] ${collection} ${doc?.number ?? doc?.id}: ${(e as Error)?.message ?? "settling points failed"}`);
    }
    return doc;
  };
}

/**
 * Member rewards end to end against a real Payload instance (D47): the settings and their approval,
 * joining and signing in, earning and spending points at checkout, declines, refunds, staff
 * adjustments, and who can see and change what.
 */
import type { Payload } from "payload";
import { beforeAll, describe, expect, it } from "vitest";

import type { Member, Order, Reservation, User } from "@/payload-types";
import { loadCheckoutContext, placeOrder, type CheckoutContext } from "@/src/lib/checkout/service";
import { newSubmission } from "@/src/lib/checkout/submission";
import type { ChargeInput, ChargeResult, PaymentProvider } from "@/src/lib/payments";
import { readSession, issueSession } from "@/src/lib/rewards/credentials";
import { balanceOf, entryKey, postEntry } from "@/src/lib/rewards/ledger";
import {
  endAllSessions,
  finishPasswordReset,
  joinMember,
  loadRewardsConfig,
  memberForSession,
  memberHistory,
  memberOrders,
  RESET_LINK_INVALID,
  SIGN_IN_FAILED,
  signIn,
  startPasswordReset,
  type MemberView,
} from "@/src/lib/rewards/members";
import { rewardsState } from "@/src/lib/rewards/program";

import { bagWith, FORM, makeProduct, NOW, setupWorld, type World } from "./inventory-fixtures";

let w: World;
let payload: Payload;
let ctx: CheckoutContext;

const FORBIDDEN = /not allowed to perform this action/i;
const PASSWORD = "Sweet-Treats-2026";

const settings = (user: User, data: Record<string, unknown>) => payload.updateGlobal({ slug: "rewards-settings", data, user, overrideAccess: false });

function scripted(...script: ChargeResult[]) {
  const calls: ChargeInput[] = [];
  const provider: PaymentProvider = {
    id: "fake-live",
    test: false,
    async charge(input) {
      calls.push(input);
      return script[Math.min(calls.length - 1, script.length - 1)];
    },
  };
  return { provider, calls };
}
const paid: ChargeResult = { status: "paid", reference: "live_1" };
const declined: ChargeResult = { status: "failed", reference: "", message: "card declined" };
const unknown: ChargeResult = { status: "unknown", reference: "", message: "timeout" };

const orderOf = async (number: string) => (await payload.find({ collection: "orders", where: { number: { equals: number } }, depth: 0, overrideAccess: true })).docs[0] as Order;
const entries = async (memberId: number) =>
  (await payload.find({ collection: "reward-entries", where: { member: { equals: memberId } }, sort: "id", limit: 100, depth: 0, overrideAccess: true })).docs;

let counter = 0;
async function join(extra: Record<string, unknown> = {}): Promise<MemberView> {
  const config = await loadRewardsConfig(payload);
  const result = await joinMember(payload, { name: "Pat Member", email: `pat${++counter}@example.test`, password: PASSWORD, agree: "yes", ...extra }, config, NOW);
  if (!result.ok) throw new Error(result.error);
  return result.member;
}

async function order(memberId: number | null, opts: { priceCents?: number; reward?: string; c?: CheckoutContext } = {}) {
  const p = await makeProduct(w, { priceCents: opts.priceCents ?? 2000, stock: 50 });
  const token = await bagWith(w, p.id, 1);
  return placeOrder(payload, { cartToken: token, form: { ...FORM, ...(opts.reward ? { reward: opts.reward } : {}) }, submission: newSubmission("order"), memberId, now: NOW }, opts.c ?? ctx);
}

beforeAll(async () => {
  w = await setupWorld();
  payload = w.payload;
});

describe("rewards settings (D47)", () => {
  it("start switched off with nothing filled in, so nothing shows", async () => {
    const config = await loadRewardsConfig(payload);
    expect(config).toMatchObject({ enabled: false, approved: false, pointsPerDollar: null, welcomePoints: 0, options: [], terms: "" });
    expect(rewardsState(config, {}).active).toBe(false);
    expect(rewardsState(config, { APP_ENV: "staging" }).active).toBe(false);
  });

  it("can't be switched on incomplete, and only the owner approves", async () => {
    await expect(settings(w.manager, { enabled: true })).rejects.toThrow(/points a dollar/);
    await settings(w.manager, { enabled: true, pointsPerDollar: 1, welcomePoints: 50, rewards: [{ pointsRequired: 100, discountCents: 500 }, { pointsRequired: 250, discountCents: 1500 }] });
    await expect(settings(w.owner, { approved: true })).rejects.toThrow(/terms/);
    // A manager can't tick Approved: the field is the owner's, so the tick is simply not saved.
    expect(await settings(w.manager, { approved: true, terms: "Points have no cash value." })).toMatchObject({ approved: false });
    await settings(w.owner, { approved: true });
    expect(rewardsState(await loadRewardsConfig(payload), {})).toEqual({ active: true, draft: false, reason: null });
  });

  it("loses the owner's approval when a manager changes what customers rely on", async () => {
    await settings(w.manager, { programName: "Rewards" }); // unchanged wording keeps it
    expect((await loadRewardsConfig(payload)).approved).toBe(true);
    await settings(w.manager, { pointsPerDollar: 2 });
    expect((await loadRewardsConfig(payload)).approved).toBe(false);
    await settings(w.owner, { pointsPerDollar: 1, approved: true });
    expect((await loadRewardsConfig(payload)).approved).toBe(true);
  });

  it("is readable and editable by staff only", async () => {
    await expect(payload.findGlobal({ slug: "rewards-settings", overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(settings(w.fulfillment, { enabled: false })).rejects.toThrow(FORBIDDEN);
    ctx = await loadCheckoutContext(payload, { APP_ENV: "test" });
    expect(ctx.rewards.active).toBe(true);
  });
});

describe("joining and signing in", () => {
  it("creates a member with welcome points and a hashed password", async () => {
    const member = await join({ email: "  New@Example.TEST " });
    expect(member).toMatchObject({ email: "new@example.test", pointsBalance: 50 });
    const stored = (await payload.findByID({ collection: "members", id: member.id, overrideAccess: true, showHiddenFields: true })) as Member;
    expect(stored.passwordHash).toMatch(/^scrypt\$/);
    expect(stored.passwordHash).not.toContain(PASSWORD);
    expect(stored.termsAcceptedAt).toBeTruthy();
    expect(await entries(member.id)).toEqual([expect.objectContaining({ kind: "welcome", points: 50, balanceAfter: 50 })]);
  });

  it("refuses a weak password, a missing agreement and a second account for the same email", async () => {
    const config = await loadRewardsConfig(payload);
    const base = { name: "Sam", email: "sam@example.test", password: PASSWORD, agree: "yes" };
    expect(await joinMember(payload, { ...base, password: "password" }, config)).toMatchObject({ ok: false, error: expect.stringContaining("12") });
    expect(await joinMember(payload, { ...base, agree: undefined }, config)).toMatchObject({ ok: false, error: expect.stringContaining("terms") });
    expect(await joinMember(payload, base, config)).toMatchObject({ ok: true });
    expect(await joinMember(payload, { ...base, email: "SAM@example.test" }, config)).toMatchObject({ ok: false, error: expect.stringContaining("already") });
  });

  it("answers the same for an unknown email and a wrong password, and pauses after five failures", async () => {
    const member = await join({ email: "lock@example.test" });
    expect(await signIn(payload, { email: "nobody@example.test", password: PASSWORD }, NOW)).toEqual({ ok: false, error: SIGN_IN_FAILED });
    for (let i = 0; i < 5; i++) expect(await signIn(payload, { email: "lock@example.test", password: "wrong-password-1A" }, NOW)).toEqual({ ok: false, error: SIGN_IN_FAILED });
    // Locked: even the right password is refused, until the pause is over.
    expect(await signIn(payload, { email: "lock@example.test", password: PASSWORD }, NOW)).toEqual({ ok: false, error: SIGN_IN_FAILED });
    const later = new Date(NOW.getTime() + 16 * 60_000);
    expect(await signIn(payload, { email: "LOCK@example.test", password: PASSWORD }, later)).toMatchObject({ ok: true, member: { id: member.id } });
  });

  it("ends sessions on a password reset, sign-out everywhere, or a closed account", async () => {
    const member = await join({ email: "reset@example.test" });
    const claims = readSession(issueSession(member.id, member.sessionVersion, NOW), NOW);
    expect(await memberForSession(payload, claims)).toMatchObject({ id: member.id });

    const sent: { to: unknown; text?: unknown }[] = [];
    const original = payload.sendEmail;
    payload.sendEmail = (async (m: { to: unknown; text?: unknown }) => void sent.push(m)) as typeof payload.sendEmail;
    try {
      expect(await startPasswordReset(payload, { email: "nobody@example.test" }, { APP_ENV: "test", EMAIL_FROM: "shop@example.test" }, NOW)).toMatchObject({ ok: true });
      expect(sent).toHaveLength(0);
      await startPasswordReset(payload, { email: "reset@example.test" }, { APP_ENV: "test", EMAIL_FROM: "shop@example.test" }, NOW);
    } finally {
      payload.sendEmail = original;
    }
    expect(sent).toHaveLength(1);
    const token = /token=([\w-]+)/.exec(String(sent[0].text))?.[1];
    expect(token).toBeTruthy();

    expect(await finishPasswordReset(payload, { token: "x".repeat(40), password: "Another-Good-Pass-9" }, NOW)).toEqual({ ok: false, error: RESET_LINK_INVALID });
    const late = new Date(NOW.getTime() + 61 * 60_000);
    expect(await finishPasswordReset(payload, { token, password: "Another-Good-Pass-9" }, late)).toEqual({ ok: false, error: RESET_LINK_INVALID });
    const done = await finishPasswordReset(payload, { token, password: "Another-Good-Pass-9" }, NOW);
    expect(done).toMatchObject({ ok: true });
    expect(await memberForSession(payload, claims)).toBeNull();
    expect(await finishPasswordReset(payload, { token, password: "Yet-Another-Pass-77" }, NOW)).toEqual({ ok: false, error: RESET_LINK_INVALID });
    expect(await signIn(payload, { email: "reset@example.test", password: "Another-Good-Pass-9" }, NOW)).toMatchObject({ ok: true });

    const fresh = done.ok ? done.member : member;
    const claims2 = readSession(issueSession(fresh.id, fresh.sessionVersion, NOW), NOW);
    await endAllSessions(payload, member.id);
    expect(await memberForSession(payload, claims2)).toBeNull();

    const current = (await payload.findByID({ collection: "members", id: member.id, overrideAccess: true, showHiddenFields: true })) as Member;
    const claims3 = readSession(issueSession(member.id, Number(current.sessionVersion), NOW), NOW);
    expect(await memberForSession(payload, claims3)).not.toBeNull();
    await payload.update({ collection: "members", id: member.id, data: { status: "closed" }, user: w.manager, overrideAccess: false });
    expect(await memberForSession(payload, claims3)).toBeNull();
    expect(await signIn(payload, { email: "reset@example.test", password: "Another-Good-Pass-9" }, NOW)).toEqual({ ok: false, error: SIGN_IN_FAILED });
  });
});

describe("earning and spending at checkout", () => {
  it("earns on a paid order placed while signed in, and nothing for guests", async () => {
    const member = await join();
    const placed = await order(member.id, { priceCents: 2550 });
    expect(placed).toMatchObject({ ok: true });
    const o = await orderOf((placed as { number: string }).number);
    expect(o).toMatchObject({ paymentStatus: "paid", totals: { subtotalCents: 2550, discountCents: 0, taxCents: 159, totalCents: 2709 }, rewards: { member: member.id, redeemedPoints: 0, earnPoints: 25 } });
    expect(await balanceOf(payload, member.id)).toBe(75);
    expect(await memberOrders(payload, member.id)).toEqual([expect.objectContaining({ number: o.number, totalCents: 2709 })]);

    const guest = await order(null);
    expect(guest).toMatchObject({ ok: true });
    expect((await orderOf((guest as { number: string }).number)).rewards?.member ?? null).toBeNull();
  });

  it("takes a reward off before tax, spends the points and earns on what was paid", async () => {
    const member = await join();
    await postEntry(payload, { memberId: member.id, kind: "adjust", points: 100, key: entryKey.adjust(`test-${member.id}`), note: "test" });
    const option = ctx.rewards.config.options.find((o) => o.pointsRequired === 100)!;
    const placed = await order(member.id, { priceCents: 2000, reward: option.id });
    expect(placed).toMatchObject({ ok: true });
    const o = await orderOf((placed as { number: string }).number);
    // $20.00 − $5.00 = $15.00, tax 6.25% = $0.94.
    expect(o.totals).toMatchObject({ subtotalCents: 2000, discountCents: 500, taxCents: 94, totalCents: 1594 });
    expect(o.rewards).toMatchObject({ redeemedPoints: 100, earnPoints: 15 });
    expect((o.lines as { discountCents?: number; taxCents: number }[])[0]).toMatchObject({ discountCents: 500, taxCents: 94 });
    expect(await balanceOf(payload, member.id)).toBe(150 - 100 + 15);
    const history = await memberHistory(payload, member.id);
    expect(history.map((h) => [h.kind, h.points])).toEqual([
      ["earn", 15],
      ["redeem", -100],
      ["adjust", 100],
      ["welcome", 50],
    ]);
  });

  it("refuses a reward the member can't pay for, one worth more than the order, and one for a guest", async () => {
    const member = await join();
    const big = ctx.rewards.config.options.find((o) => o.pointsRequired === 250)!;
    expect(await order(member.id, { reward: big.id })).toMatchObject({ ok: false, error: expect.stringContaining("enough points") });
    await postEntry(payload, { memberId: member.id, kind: "adjust", points: 300, key: entryKey.adjust(`big-${member.id}`) });
    expect(await order(member.id, { priceCents: 1000, reward: big.id })).toMatchObject({ ok: false, error: expect.stringContaining("worth more") });
    expect(await order(null, { reward: big.id })).toMatchObject({ ok: false, error: expect.stringContaining("sign in") });
    expect(await order(member.id, { reward: "made-up" })).toMatchObject({ ok: false, error: expect.stringContaining("isn't available") });
    expect(await balanceOf(payload, member.id)).toBe(350);
  });

  it("lets only one of two simultaneous orders spend the same points", async () => {
    const member = await join(); // 50 welcome points
    await postEntry(payload, { memberId: member.id, kind: "adjust", points: 50, key: entryKey.adjust(`race-${member.id}`) });
    const option = ctx.rewards.config.options.find((o) => o.pointsRequired === 100)!;
    const results = await Promise.all([order(member.id, { reward: option.id }), order(member.id, { reward: option.id })]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ error: expect.stringContaining("enough points") });
    expect(await balanceOf(payload, member.id)).toBe(0 + 15);
  });

  it("gives the points back when the card is declined, and spends them again on the retry", async () => {
    const member = await join();
    await postEntry(payload, { memberId: member.id, kind: "adjust", points: 50, key: entryKey.adjust(`decline-${member.id}`) });
    const option = ctx.rewards.config.options.find((o) => o.pointsRequired === 100)!;
    const { provider, calls } = scripted(declined, paid);
    const c = { ...ctx, provider, chargeTimeoutMs: 200 };
    const p = await makeProduct(w, { priceCents: 2000, stock: 50 });
    const token = await bagWith(w, p.id, 1);
    const submission = newSubmission("order");
    const form = { ...FORM, reward: option.id };
    expect(await placeOrder(payload, { cartToken: token, form, submission, memberId: member.id, now: NOW }, c)).toMatchObject({ ok: false });
    expect(await balanceOf(payload, member.id)).toBe(100);
    expect(calls[0].amountCents).toBe(1594);
    const retry = await placeOrder(payload, { cartToken: token, form, submission, memberId: member.id, now: NOW }, c);
    expect(retry).toMatchObject({ ok: true });
    expect(await balanceOf(payload, member.id)).toBe(15);
    expect((await entries(member.id)).map((e) => [e.kind, e.points])).toEqual([
      ["welcome", 50],
      ["adjust", 50],
      ["redeem", -100],
      ["restore", 100],
      ["redeem", -100],
      ["earn", 15],
    ]);
  });

  it("keeps the points of an unknown payment until staff decide, and returns them when it failed", async () => {
    const member = await join();
    await postEntry(payload, { memberId: member.id, kind: "adjust", points: 50, key: entryKey.adjust(`unknown-${member.id}`) });
    const option = ctx.rewards.config.options.find((o) => o.pointsRequired === 100)!;
    const { provider } = scripted(unknown);
    const placed = await order(member.id, { reward: option.id, c: { ...ctx, provider, chargeTimeoutMs: 200 } });
    expect(placed).toMatchObject({ ok: false, error: expect.stringContaining("couldn't confirm") });
    expect(await balanceOf(payload, member.id)).toBe(0);
    const o = (await payload.find({ collection: "orders", where: { "rewards.member": { equals: member.id } }, depth: 0, overrideAccess: true })).docs[0] as Order;
    await payload.update({ collection: "orders", id: o.id, data: { paymentStatus: "failed" }, user: w.manager, overrideAccess: false });
    expect(await balanceOf(payload, member.id)).toBe(100);
  });

  it("takes back earned points and returns spent ones when staff refund an order", async () => {
    const member = await join();
    await postEntry(payload, { memberId: member.id, kind: "adjust", points: 50, key: entryKey.adjust(`refund-${member.id}`) });
    const option = ctx.rewards.config.options.find((o) => o.pointsRequired === 100)!;
    const placed = await order(member.id, { reward: option.id });
    const o = await orderOf((placed as { number: string }).number);
    expect(await balanceOf(payload, member.id)).toBe(15);
    await payload.update({ collection: "orders", id: o.id, data: { paymentStatus: "refunded" }, user: w.manager, overrideAccess: false });
    await payload.update({ collection: "orders", id: o.id, data: { staffNotes: "saved again" }, user: w.manager, overrideAccess: false });
    expect(await balanceOf(payload, member.id)).toBe(100);
    expect((await entries(member.id)).slice(-2).map((e) => [e.kind, e.points])).toEqual([
      ["reverse", -15],
      ["restore", 100],
    ]);
  });

  it("can take a refunded balance below zero when the earned points were already spent", async () => {
    const member = await join({ welcome: 0 });
    const placed = await order(member.id, { priceCents: 10000 }); // earns 100
    expect(await balanceOf(payload, member.id)).toBe(150);
    const option = ctx.rewards.config.options.find((o) => o.pointsRequired === 100)!;
    expect(await order(member.id, { reward: option.id })).toMatchObject({ ok: true }); // spends 100, earns 15
    const o = await orderOf((placed as { number: string }).number);
    await payload.update({ collection: "orders", id: o.id, data: { paymentStatus: "refunded" }, user: w.owner, overrideAccess: false });
    expect(await balanceOf(payload, member.id)).toBe(65 - 100);
  });

  it("earns on a basket reservation only once it is paid in full", async () => {
    const member = await join();
    const reservation = (await payload.create({
      collection: "reservations",
      data: {
        number: `SPR-${9000 + member.id}`,
        accessTokenHash: "x",
        idempotencyKey: `test-res-${member.id}`,
        reservationStatus: "confirmed",
        paymentStatus: "deposit_paid",
        customer: { name: "Pat", email: "pat@example.test", phone: "5085550100" },
        pickup: { date: "2026-10-08", start: "11:00", end: "12:00" },
        basket: {},
        totalCents: 5313,
        taxCents: 313,
        depositCents: 1328,
        amountPaidCents: 1328,
        balanceDueCents: 3985,
        rewards: { member: member.id, earnPoints: 50 },
      } as never,
      overrideAccess: true,
    })) as Reservation;
    expect(await balanceOf(payload, member.id)).toBe(50);
    await payload.update({ collection: "reservations", id: reservation.id, data: { paymentStatus: "paid_in_full", amountPaidCents: 5313, balanceDueCents: 0 }, user: w.manager, overrideAccess: false });
    expect(await balanceOf(payload, member.id)).toBe(100);
  });
});

describe("staff and access", () => {
  it("adjusts points through Points adjustments: owner and manager only, never below zero", async () => {
    const member = await join();
    const adj = await payload.create({ collection: "reward-adjustments", data: { member: member.id, points: 20, note: "Goodwill" }, user: w.manager, overrideAccess: false });
    expect(adj).toMatchObject({ balanceAfter: 70, user: expect.objectContaining({ id: w.manager.id }) });
    await expect(payload.create({ collection: "reward-adjustments", data: { member: member.id, points: -500, note: "Too much" }, user: w.owner, overrideAccess: false })).rejects.toThrow(/below zero/);
    await expect(payload.create({ collection: "reward-adjustments", data: { member: member.id, points: 5, note: "x" }, user: w.fulfillment, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.create({ collection: "reward-adjustments", data: { member: member.id, points: 5 } as never, user: w.owner, overrideAccess: false })).rejects.toThrow();
    expect(await balanceOf(payload, member.id)).toBe(70);
    expect((await entries(member.id)).at(-1)).toMatchObject({ kind: "adjust", points: 20, user: w.manager.id, note: "Goodwill" });
  });

  it("never lets a staff save change a balance, and keeps the ledger read only", async () => {
    const member = await join();
    await payload.update({ collection: "members", id: member.id, data: { pointsBalance: 99999, name: "Pat Renamed" } as never, user: w.owner, overrideAccess: false });
    const after = (await payload.findByID({ collection: "members", id: member.id, overrideAccess: true })) as Member;
    expect(after).toMatchObject({ pointsBalance: 50, name: "Pat Renamed" });
    const entry = (await entries(member.id))[0];
    await expect(payload.create({ collection: "reward-entries", data: { member: member.id, kind: "adjust", points: 1, idempotencyKey: "x" }, user: w.owner, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.update({ collection: "reward-entries", id: entry.id, data: { points: 9999 }, user: w.owner, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.delete({ collection: "reward-entries", id: entry.id, user: w.owner, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
  });

  it("keeps members private: no public reads or sign-ups through the API, and no password hashes for staff", async () => {
    const member = await join();
    await expect(payload.find({ collection: "members", overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.find({ collection: "reward-entries", overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.create({ collection: "members", data: { name: "Bot", email: "bot@example.test" } as never, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    const seen = (await payload.findByID({ collection: "members", id: member.id, user: w.owner, overrideAccess: false })) as Member;
    expect(seen.email).toBeTruthy();
    for (const secret of ["passwordHash", "sessionVersion", "resetTokenHash", "failedSignIns", "lockedUntil", "resetExpiresAt"] as const) expect(seen[secret]).toBeUndefined();
    await expect(payload.update({ collection: "members", id: member.id, data: { name: "x" }, user: w.fulfillment, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
    await expect(payload.delete({ collection: "members", id: member.id, user: w.manager, overrideAccess: false })).rejects.toThrow(FORBIDDEN);
  });

  it("lets the owner delete a member and keeps the points history without them", async () => {
    const member = await join();
    const stored = (await payload.findByID({ collection: "members", id: member.id, overrideAccess: true })) as Member;
    await payload.delete({ collection: "members", id: member.id, user: w.owner, overrideAccess: false });
    const left = await payload.find({ collection: "reward-entries", where: { idempotencyKey: { equals: entryKey.welcome(stored) } }, depth: 0, overrideAccess: true });
    expect(left.docs).toEqual([expect.objectContaining({ kind: "welcome", member: null })]);
    // SQLite gives the next member the deleted one's id; they still get their own welcome points.
    const next = await join();
    expect(next.id).toBe(member.id);
    expect(await balanceOf(payload, next.id)).toBe(50);
  });

  it("stops earning and spending when the program is switched off", async () => {
    const member = await join();
    await settings(w.owner, { enabled: false });
    const off = await loadCheckoutContext(payload, { APP_ENV: "test" });
    expect(off.rewards.active).toBe(false);
    const placed = await order(member.id, { c: off });
    expect(placed).toMatchObject({ ok: true });
    expect((await orderOf((placed as { number: string }).number)).rewards?.member ?? null).toBeNull();
    expect(await balanceOf(payload, member.id)).toBe(50);
  });
});

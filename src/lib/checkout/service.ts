/**
 * Checkout services (D35, D36, D40): bag storage, order placement and basket reservations. Framework
 * free (takes the Payload instance, the cart token and "now"), so integration tests drive the
 * exact code the server actions run. Every price, tax, slot and rule is re-read here; nothing
 * from the browser is trusted beyond ids, quantities and contact details.
 *
 * Stock (D40): placing an order or reserving a basket first holds every component for the customer
 * (all or nothing, expiring), then creates the record and charges. A paid result turns the holds
 * into sale movements, each component exactly once; a failed charge or an error releases them. If
 * the stock can't be taken after a successful payment, the paid record is kept and flagged for
 * staff, and nobody is charged again.
 */
import crypto from "node:crypto";

import type { Payload } from "payload";

import type { CheckoutSetting, Order, Product, Reservation } from "@/payload-types";

import { loadBuilderCatalogFrom } from "../catalog/builder-catalog";
import { previewStockEnabled } from "../catalog/preview";
import { catalogOf, resolveBasketSize, validateGift } from "../gifts";
import type { GiftRequest, Selection } from "../gifts/types";
import { query } from "../inventory/db";
import { holdStock, readUnit, releaseHolds } from "../inventory/ledger";
import { bagOwner, basketOwner, serializePlan } from "../inventory/records";
import { settleStock } from "../inventory/settle";
import type { PlanLine } from "../inventory/types";
import { bomOf, planFor } from "../inventory/units";
import { applyInventoryView, loadInventoryConfig, type InventoryConfig } from "../inventory/view";
import { getPaymentProvider, orderingState, type OrderingState, type PaymentProvider } from "../payments";
import { priceCart, MAX_LINE_QUANTITY, type CartLine, type PricedCart } from "./cart";
import { paymentPlan, type DepositRule } from "./deposit";
import { nextSequence } from "./numbering";
import { assemblyInstructions, formatNumber, hashToken, idempotencyKey, type BasketComponent } from "./order";
import { formatSlot, isAvailableSlot, type PickupSettings, type Slot } from "./pickup";
import { computeTax, resolveTaxClass, type TaxClass } from "./tax";

export type CheckoutContext = {
  taxClasses: TaxClass[];
  defaultTaxClassId: string | null;
  packagingTaxClassId: string | null;
  pickup: PickupSettings;
  reservationLeadHours: number;
  deposit: DepositRule;
  allowPayInFull: boolean;
  provider: PaymentProvider | null;
  /** Holds and stock freshness (Settings → Inventory), plus the staging-only "assume stock" aid. */
  inventory: InventoryConfig & { assumeUnknown: boolean };
};

const relId = (v: unknown): string | null => (v === null || v === undefined ? null : typeof v === "object" ? String((v as { id: unknown }).id) : String(v));

const SOLD_OUT = "Some items in your bag aren't available any more. Please review your bag.";

export async function loadCheckoutContext(payload: Payload, env: Record<string, string | undefined> = process.env): Promise<CheckoutContext> {
  const [settings, classes, inventory] = await Promise.all([
    payload.findGlobal({ slug: "checkout-settings", depth: 0, overrideAccess: true }) as Promise<CheckoutSetting>,
    payload.find({ collection: "tax-classes", limit: 100, depth: 0, overrideAccess: true }),
    loadInventoryConfig(payload),
  ]);
  return {
    taxClasses: classes.docs.map((c) => ({ id: String(c.id), name: c.name, rateBasisPoints: c.rateBasisPoints, approved: Boolean(c.approved) })),
    defaultTaxClassId: relId(settings.defaultTaxClass),
    packagingTaxClassId: relId(settings.packagingTaxClass),
    pickup: {
      hours: (settings.pickupHours ?? []).map((h) => ({ weekday: Number(h.weekday), open: h.open, close: h.close })),
      slotMinutes: settings.slotMinutes ?? 60,
      leadTimeHours: settings.leadTimeHours ?? 24,
      daysAhead: settings.daysAhead ?? 14,
      closedDates: (settings.closedDates ?? []).map((d) => d.date),
    },
    reservationLeadHours: settings.reservationLeadHours ?? 48,
    deposit: {
      type: settings.depositType === "flat" ? "flat" : "percent",
      percentBasisPoints: settings.depositPercentBasisPoints ?? 2500,
      flatCents: settings.depositFlatCents ?? 0,
    },
    allowPayInFull: settings.allowPayInFull !== false,
    provider: getPaymentProvider(env),
    inventory: { ...inventory, assumeUnknown: previewStockEnabled(env) },
  };
}

// ---------------------------------------------------------------- bag

export function newCartToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

async function findCart(payload: Payload, token: string | undefined) {
  if (!token) return null;
  const { docs } = await payload.find({ collection: "carts", where: { tokenHash: { equals: hashToken(token) } }, limit: 1, depth: 0, overrideAccess: true });
  return docs[0] ?? null;
}

export async function readCartLines(payload: Payload, token: string | undefined): Promise<CartLine[]> {
  const cart = await findCart(payload, token);
  return (cart?.lines ?? []).map((l) => ({ unitId: l.unitId, quantity: l.quantity }));
}

async function writeCartLines(payload: Payload, token: string, lines: CartLine[]) {
  const cart = await findCart(payload, token);
  const data = { lines: lines.map((l) => ({ unitId: l.unitId, quantity: l.quantity })) };
  if (cart) await payload.update({ collection: "carts", id: cart.id, data, overrideAccess: true });
  else await payload.create({ collection: "carts", data: { tokenHash: hashToken(token), ...data }, overrideAccess: true });
}

/** How stock is seen: other customers' holds subtracted, stale counts unknown, baskets from their parts. */
type StockView = { config: InventoryConfig; now: Date; exceptOwner: string | null };

async function loadProducts(payload: Payload, ids: string[], view: StockView): Promise<Product[]> {
  if (!ids.length) return [];
  const { docs } = await payload.find({
    collection: "products",
    where: { and: [{ id: { in: ids } }, { _status: { equals: "published" } }] },
    limit: ids.length,
    depth: 0,
    overrideAccess: false,
  });
  const seen = await applyInventoryView(payload, docs as Product[], { now: view.now, exceptOwner: view.exceptOwner, config: view.config });
  return seen.products;
}

async function priceBagWith(payload: Payload, token: string | undefined, ctx: CheckoutContext, now: Date): Promise<{ bag: PricedCart; products: Product[] }> {
  const lines = await readCartLines(payload, token);
  const view: StockView = { config: ctx.inventory, now, exceptOwner: token ? bagOwner(hashToken(token)) : null };
  const products = await loadProducts(payload, [...new Set(lines.map((l) => l.unitId.split(":")[0]))], view);
  const bag = priceCart(lines, products, { previewStock: previewStockEnabled(), taxClasses: ctx.taxClasses, defaultTaxClassId: ctx.defaultTaxClassId });
  return { bag, products };
}

export async function priceBag(payload: Payload, token: string | undefined, ctx: CheckoutContext, now: Date = new Date()): Promise<PricedCart> {
  return (await priceBagWith(payload, token, ctx, now)).bag;
}

/** Add, set or remove a bag line. Only purchasable units are accepted; quantities are clamped. */
export async function changeBag(
  payload: Payload,
  token: string,
  change: { unitId: string; quantity: number; mode: "add" | "set" },
  ctx: CheckoutContext,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  const unitId = String(change.unitId).slice(0, 80);
  if (!/^\d+(:[\w-]{1,40})?$/.test(unitId)) return { ok: false, error: "That item couldn't be found." };
  const qty = Math.trunc(Number(change.quantity));
  const lines = await readCartLines(payload, token);
  const existing = lines.find((l) => l.unitId === unitId);
  const next = change.mode === "add" ? (existing?.quantity ?? 0) + Math.max(1, qty || 1) : qty;

  if (next <= 0) {
    await writeCartLines(payload, token, lines.filter((l) => l.unitId !== unitId));
    return { ok: true };
  }
  const products = await loadProducts(payload, [unitId.split(":")[0]], { config: ctx.inventory, now, exceptOwner: bagOwner(hashToken(token)) });
  const priced = priceCart([{ unitId, quantity: next }], products, {
    previewStock: previewStockEnabled(),
    taxClasses: ctx.taxClasses,
    defaultTaxClassId: ctx.defaultTaxClassId,
  });
  const line = priced.lines[0];
  if (!line || line.problem?.blocking) return { ok: false, error: "Sorry, that item isn't available to order online right now." };
  const quantity = Math.min(line.quantity, MAX_LINE_QUANTITY);
  await writeCartLines(payload, token, existing ? lines.map((l) => (l.unitId === unitId ? { unitId, quantity } : l)) : [...lines, { unitId, quantity }]);
  return { ok: true };
}

// ---------------------------------------------------------------- contact & pickup

export type ContactInput = { name: string; email: string; phone: string };

export function parseContact(input: Record<string, unknown>): { ok: true; contact: ContactInput } | { ok: false; error: string } {
  const name = String(input.name ?? "").trim().slice(0, 100);
  const email = String(input.email ?? "").trim().slice(0, 200);
  const phone = String(input.phone ?? "").trim().slice(0, 30);
  if (!name) return { ok: false, error: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (phone.replace(/\D/g, "").length < 10) return { ok: false, error: "Please enter a phone number we can reach you on." };
  return { ok: true, contact: { name, email, phone } };
}

function pickSlot(ctx: CheckoutContext, now: Date, raw: unknown, leadHours: number): Slot | null {
  const [date, start] = String(raw ?? "").split("|");
  if (!date || !start) return null;
  return isAvailableSlot(ctx.pickup, now, { date, start }, leadHours);
}

/** The URL token for a record is derived from its idempotency key, so a retried submit lands on the same page. */
function urlToken(kind: string, key: string): string {
  const secret = process.env.PAYLOAD_SECRET;
  if (!secret) throw new Error("PAYLOAD_SECRET is required");
  return crypto.createHmac("sha256", secret).update(`${kind}:${key}`).digest("base64url");
}

const PREFIX = { orders: "SP", reservations: "SPR" } as const;

/**
 * One above the highest number ever used (A02). Counting rows reused a number the moment the
 * owner deleted an early order, so every later checkout collided until it gave up. `bump` skips
 * ahead after a collision.
 */
async function nextNumber(payload: Payload, collection: "orders" | "reservations", bump = 0): Promise<string> {
  const prefix = PREFIX[collection];
  const [row] = await query(payload, `SELECT MAX(CAST(substr(number, :from) AS INTEGER)) AS highest FROM ${collection} WHERE number LIKE :like`, {
    from: prefix.length + 2,
    like: `${prefix}-%`,
  });
  const highest = row?.highest === null || row?.highest === undefined ? null : Number(row.highest);
  return formatNumber(prefix, nextSequence(highest, bump));
}

async function findByKey(payload: Payload, collection: "orders" | "reservations", key: string) {
  return (await payload.find({ collection, where: { idempotencyKey: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] ?? null;
}

/** True when creating a record failed only because its number is already taken. */
export function isNumberCollision(e: unknown): boolean {
  const text = `${(e as Error)?.message ?? ""} ${JSON.stringify((e as { data?: unknown })?.data ?? "")}`.toLowerCase();
  return text.includes("number") && /unique|already|invalid/.test(text);
}

/**
 * Creates the record once per idempotency key with the next free number. If a simultaneous
 * duplicate submission won the race, its record is returned instead; if two different submissions
 * raced for the same number, the loser retries with a higher one. Any other error is raised.
 */
async function createOnce<T>(payload: Payload, collection: "orders" | "reservations", key: string, data: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const existing = await findByKey(payload, collection, key);
    if (existing) return existing as T;
    const number = await nextNumber(payload, collection, attempt);
    try {
      return (await payload.create({ collection, data: { ...data, idempotencyKey: key, number } as never, overrideAccess: true })) as T;
    } catch (e) {
      const winner = await findByKey(payload, collection, key);
      if (winner) return winner as T;
      if (!isNumberCollision(e) || attempt >= 4) throw e;
    }
  }
}

export type PlaceResult = { ok: true; number: string; token: string } | { ok: false; error: string };

// ---------------------------------------------------------------- stock plan

/** What a bag takes from stock: a curated basket with contents takes its parts, never itself (INV 01). */
function planOfBag(payable: readonly { unitId: string; quantity: number }[], products: readonly Product[]): PlanLine[] {
  const byId = new Map(products.map((p) => [String(p.id), p]));
  return planFor(payable, (id) => bomOf(byId.get(id)));
}

/** Staging only: stock that was never counted is assumed to exist, so it has nothing to hold or deduct. */
async function trackedOnly(payload: Payload, plan: PlanLine[], ctx: CheckoutContext, now: Date): Promise<PlanLine[]> {
  if (!ctx.inventory.assumeUnknown) return plan;
  const kept: PlanLine[] = [];
  for (const line of plan) if ((await readUnit(payload, line, { now, maxAgeMs: null }))?.known) kept.push(line);
  return kept;
}

const holdFor = (ctx: CheckoutContext, now: Date) => ({ now, ttlMs: ctx.inventory.holdMinutes * 60_000, maxAgeMs: ctx.inventory.maxAgeMs });

// ---------------------------------------------------------------- shop orders

export async function placeOrder(
  payload: Payload,
  input: { cartToken: string | undefined; form: Record<string, unknown>; now?: Date },
  ctx: CheckoutContext,
): Promise<PlaceResult> {
  const now = input.now ?? new Date();
  const state = orderingState(ctx.provider, false);
  if (!state.open) return { ok: false, error: "Online payment is coming soon. Please call us to order." };

  const { bag, products } = await priceBagWith(payload, input.cartToken, ctx, now);
  if (!bag.payable.length) return { ok: false, error: "Your bag is empty." };
  if (bag.blocking) return { ok: false, error: "Some items in your bag aren't available. Please review your bag." };

  const contact = parseContact(input.form);
  if (!contact.ok) return contact;
  const slot = pickSlot(ctx, now, input.form.pickup, ctx.pickup.leadTimeHours);
  if (!slot) return { ok: false, error: "That pickup time is no longer available. Please choose another." };
  const notes = String(input.form.notes ?? "").trim().slice(0, 500);

  const cartHash = hashToken(input.cartToken ?? "");
  const owner = bagOwner(cartHash);
  const key = idempotencyKey("order", cartHash, bag.payable.map((l) => [l.unitId, l.quantity, l.unitPriceCents]), contact.contact, slot, notes);
  const token = urlToken("order", key);

  // The same submission arriving again after it was paid: nothing to charge, and stock is only
  // touched if the first attempt stopped before taking it.
  const finished = (await findByKey(payload, "orders", key)) as Order | null;
  if (finished?.paymentStatus === "paid") {
    if (finished.stockStatus === "held") await settleStock(payload, "orders", finished, now);
    if (input.cartToken) await writeCartLines(payload, input.cartToken, []);
    return { ok: true, number: finished.number, token };
  }

  const plan = await trackedOnly(payload, planOfBag(bag.payable, products), ctx, now);
  const held = await holdStock(payload, { owner, plan, ...holdFor(ctx, now) });
  if (!held.ok) return { ok: false, error: SOLD_OUT };

  let order: Order;
  try {
    order = await createOnce<Order>(payload, "orders", key, {
      accessTokenHash: hashToken(token),
      testMode: ctx.provider!.test,
      paymentStatus: "pending",
      fulfillmentStatus: "preparing",
      customer: contact.contact,
      pickup: { ...slot, label: formatSlot(slot) },
      notes,
      lines: bag.payable.map((l) => ({
        unitId: l.unitId,
        title: l.title,
        option: l.optionLabel,
        sku: l.sku,
        cloverId: l.cloverId,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        lineTotalCents: l.lineTotalCents,
        taxClass: l.taxClass ? { name: l.taxClass.name, rateBasisPoints: l.taxClass.rateBasisPoints, approved: l.taxClass.approved } : null,
        taxCents: l.taxCents,
      })),
      totals: { subtotalCents: bag.subtotalCents, taxCents: bag.taxCents, totalCents: bag.totalCents, taxApproved: bag.taxApproved },
      stockOwner: owner,
      stockPlan: serializePlan(plan),
      stockStatus: plan.length ? "held" : "none",
    });
    if (order.paymentStatus !== "paid") {
      if (plan.length && (order.stockStatus !== "held" || order.stockOwner !== owner)) {
        // A retry of an order whose earlier payment failed: its stock was released, so hold it again.
        order = await payload.update({ collection: "orders", id: order.id, data: { stockStatus: "held", stockOwner: owner, stockPlan: serializePlan(plan) }, overrideAccess: true });
      }
      const charge = await ctx.provider!.charge({ reference: order.number, amountCents: order.totals.totalCents, idempotencyKey: key });
      order = await payload.update({
        collection: "orders",
        id: order.id,
        data: {
          paymentStatus: charge.status,
          payment: { provider: ctx.provider!.id, reference: charge.reference },
          ...(charge.status !== "paid" && order.stockStatus === "held" ? { stockStatus: "released" as const } : {}),
        },
        overrideAccess: true,
      });
      if (charge.status !== "paid") {
        await releaseHolds(payload, owner, now);
        return { ok: false, error: "The payment didn't go through. Your bag is saved — please try again." };
      }
      console.info(`[order] ${order.number} placed${order.testMode ? " (test)" : ""}; confirmation email not configured yet`);
    }
  } catch (e) {
    // A failed charge or any error: the customer's stock goes back on the shelf for others.
    await releaseHolds(payload, owner, now).catch(() => undefined);
    throw e;
  }

  // Paid. Take the stock; whatever happens now the paid order stays and nobody is charged again.
  await settleStock(payload, "orders", order, now);
  await releaseHolds(payload, owner, now);
  if (input.cartToken) await writeCartLines(payload, input.cartToken, []);
  return { ok: true, number: order.number, token };
}

export async function findByToken<T extends "orders" | "reservations">(payload: Payload, collection: T, number: string, token: string | undefined) {
  if (!token || !/^SPR?-\d+$/.test(number)) return null;
  const { docs } = await payload.find({
    collection,
    where: { and: [{ number: { equals: number } }, { accessTokenHash: { equals: hashToken(token) } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  return docs[0] ?? null;
}

// ---------------------------------------------------------------- basket reservations

export type BasketDraft = { request: Extract<GiftRequest, { kind: "custom" }>; message: string; requests: string };

export type PricedBasket = {
  ok: true;
  title: string;
  basketSizeIn: string;
  components: BasketComponent[];
  /** What the basket takes from stock, after any bill of materials. */
  plan: PlanLine[];
  packagingCents: number;
  contentsCents: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  taxApproved: boolean;
};

/** One line per product with quantities added up, exactly as `validateGift` counts them. */
function mergeSelections(selections: readonly Selection[]): Selection[] {
  const merged = new Map<string, number>();
  for (const s of selections) merged.set(s.productId, (merged.get(s.productId) ?? 0) + s.quantity);
  return [...merged].filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ productId, quantity }));
}

/** Re-validates a basket with fresh prices and stock, and works out its tax (D36). */
export async function priceBasket(
  payload: Payload,
  draft: BasketDraft,
  ctx: CheckoutContext,
  opts: { now?: Date; exceptOwner?: string | null } = {},
): Promise<PricedBasket | { ok: false; error: string }> {
  const now = opts.now ?? new Date();
  const { settings, products, display } = await loadBuilderCatalogFrom(payload, { now, exceptOwner: opts.exceptOwner, config: ctx.inventory });
  const validation = validateGift(draft.request, settings, catalogOf(products));
  if (!validation.complete) {
    return { ok: false, error: validation.violations[0]?.message ?? "This basket isn't complete yet. Please go back and finish it." };
  }
  const priceOf = new Map(products.map((p) => [p.id, p.priceCents ?? 0]));
  const nameOf = new Map(display.map((d) => [d.id, d.title]));
  // Built from the merged selections the validation actually checked (A01), never from the raw
  // request: a crafted request can't make staff pack more than was validated and paid for.
  const components: BasketComponent[] = mergeSelections(draft.request.selections).map((s) => ({
    productId: s.productId,
    name: nameOf.get(s.productId) ?? s.productId,
    quantity: s.quantity,
    unitPriceCents: priceOf.get(s.productId) ?? 0,
  }));

  const productDocs = await loadProducts(payload, [...new Set(components.map((c) => c.productId.split(":")[0]))], { config: ctx.inventory, now, exceptOwner: opts.exceptOwner ?? null });
  const classOf = new Map(productDocs.map((p) => [String(p.id), resolveTaxClass(relId(p.taxClass), ctx.taxClasses, ctx.defaultTaxClassId)]));
  const packagingClass = resolveTaxClass(ctx.packagingTaxClassId, ctx.taxClasses, ctx.defaultTaxClassId);
  const tax = computeTax([
    ...components.map((c) => ({ amountCents: c.unitPriceCents * c.quantity, taxClass: classOf.get(c.productId.split(":")[0]) ?? null })),
    { amountCents: validation.totals.packagingCents, taxClass: packagingClass },
  ]);
  const size = settings.sizes.find((s) => s.code === draft.request.size);
  const giftLabel = { sweet: "Sweet", savory: "Savory", sweet_savory: "Sweet & savory", sympathy: "Sympathy" }[draft.request.giftType];
  return {
    ok: true,
    title: `${giftLabel} basket — ${size?.label ?? draft.request.size}`,
    basketSizeIn: resolveBasketSize(settings, draft.request.size, draft.request.giftType),
    components,
    plan: planOfBag(components.map((c) => ({ unitId: c.productId, quantity: c.quantity })), productDocs),
    packagingCents: validation.totals.packagingCents,
    contentsCents: validation.totals.contentsCents,
    subtotalCents: validation.totals.totalCents,
    taxCents: tax.taxCents,
    totalCents: validation.totals.totalCents + tax.taxCents,
    taxApproved: tax.approved,
  };
}

export async function reserveBasket(
  payload: Payload,
  input: { draft: BasketDraft; form: Record<string, unknown>; now?: Date },
  ctx: CheckoutContext,
): Promise<PlaceResult> {
  const now = input.now ?? new Date();
  const state: OrderingState = orderingState(ctx.provider, false);
  if (!state.open) return { ok: false, error: "Online reservations are coming soon. Please call us to reserve a basket." };

  const contact = parseContact(input.form);
  if (!contact.ok) return contact;
  const slot = pickSlot(ctx, now, input.form.pickup, ctx.reservationLeadHours);
  if (!slot) return { ok: false, error: "That pickup time is no longer available. Please choose another." };
  const payInFull = input.form.payment === "full";
  if (payInFull && !ctx.allowPayInFull) return { ok: false, error: "Please choose the deposit option." };

  // The owner is known before pricing so this customer's own earlier hold never blocks their retry.
  const owner = basketOwner(input.draft.request, contact.contact.email, slot);
  const basket = await priceBasket(payload, input.draft, ctx, { now, exceptOwner: owner });
  if (!basket.ok) return basket;

  const pay = paymentPlan(basket.totalCents, ctx.deposit, payInFull);
  const key = idempotencyKey("reservation", input.draft, contact.contact, slot, payInFull, basket.totalCents);
  const token = urlToken("reservation", key);

  const finished = (await findByKey(payload, "reservations", key)) as Reservation | null;
  if (finished && finished.paymentStatus !== "deposit_pending" && finished.paymentStatus !== "failed") {
    if (finished.stockStatus === "held") await settleStock(payload, "reservations", finished, now);
    return { ok: true, number: finished.number, token };
  }

  const plan = await trackedOnly(payload, basket.plan, ctx, now);
  const held = await holdStock(payload, { owner, plan, ...holdFor(ctx, now) });
  if (!held.ok) return { ok: false, error: "Some items in this basket have just sold out. Please go back and choose again." };

  let reservation: Reservation;
  try {
    reservation = await createOnce<Reservation>(payload, "reservations", key, {
      accessTokenHash: hashToken(token),
      testMode: ctx.provider!.test,
      // Requests are not guarantees: staff confirm them before the basket is finalised (GFT 06).
      reservationStatus: input.draft.requests.trim() ? "staff_review" : "confirmed",
      paymentStatus: "deposit_pending",
      customer: contact.contact,
      pickup: { ...slot, label: formatSlot(slot) },
      assembly: assemblyInstructions({ title: basket.title, basketSizeIn: basket.basketSizeIn, components: basket.components, message: input.draft.message, requests: input.draft.requests }),
      basket: { request: input.draft.request, title: basket.title, components: basket.components, packagingCents: basket.packagingCents, message: input.draft.message, requests: input.draft.requests },
      totalCents: basket.totalCents,
      taxCents: basket.taxCents,
      taxApproved: basket.taxApproved,
      depositCents: pay.paidInFull ? basket.totalCents : pay.chargeNowCents,
      amountPaidCents: 0,
      balanceDueCents: basket.totalCents,
      stockOwner: owner,
      stockPlan: serializePlan(plan),
      stockStatus: plan.length ? "held" : "none",
    });
    if (reservation.paymentStatus === "deposit_pending" || reservation.paymentStatus === "failed") {
      if (plan.length && (reservation.stockStatus !== "held" || reservation.stockOwner !== owner)) {
        reservation = await payload.update({ collection: "reservations", id: reservation.id, data: { stockStatus: "held", stockOwner: owner, stockPlan: serializePlan(plan) }, overrideAccess: true });
      }
      const charge = await ctx.provider!.charge({ reference: reservation.number, amountCents: pay.chargeNowCents, idempotencyKey: key });
      reservation = await payload.update({
        collection: "reservations",
        id: reservation.id,
        data:
          charge.status === "paid"
            ? {
                paymentStatus: pay.paidInFull ? "paid_in_full" : "deposit_paid",
                amountPaidCents: pay.chargeNowCents,
                balanceDueCents: pay.balanceDueCents,
                payment: { provider: ctx.provider!.id, reference: charge.reference },
              }
            : {
                paymentStatus: "failed",
                payment: { provider: ctx.provider!.id, reference: charge.reference },
                ...(reservation.stockStatus === "held" ? { stockStatus: "released" as const } : {}),
              },
        overrideAccess: true,
      });
      if (charge.status !== "paid") {
        await releaseHolds(payload, owner, now);
        return { ok: false, error: "The payment didn't go through. Please try again." };
      }
      console.info(`[reservation] ${reservation.number} reserved${reservation.testMode ? " (test)" : ""}; confirmation email not configured yet`);
    }
  } catch (e) {
    await releaseHolds(payload, owner, now).catch(() => undefined);
    throw e;
  }

  await settleStock(payload, "reservations", reservation, now);
  await releaseHolds(payload, owner, now);
  return { ok: true, number: reservation.number, token };
}

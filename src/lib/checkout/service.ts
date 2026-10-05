/**
 * Checkout services (D35, D36): bag storage, order placement and basket reservations. Framework
 * free (takes the Payload instance, the cart token and "now"), so integration tests drive the
 * exact code the server actions run. Every price, tax, slot and rule is re-read here; nothing
 * from the browser is trusted beyond ids, quantities and contact details.
 */
import crypto from "node:crypto";

import type { Payload } from "payload";

import type { CheckoutSetting, Order, Product, Reservation } from "@/payload-types";

import { loadBuilderCatalogFrom } from "../catalog/builder-catalog";
import { previewStockEnabled } from "../catalog/preview";
import { catalogOf, resolveBasketSize, validateGift } from "../gifts";
import type { GiftRequest } from "../gifts/types";
import { getPaymentProvider, orderingState, type OrderingState, type PaymentProvider } from "../payments";
import { priceCart, MAX_LINE_QUANTITY, type CartLine, type PricedCart } from "./cart";
import { paymentPlan, type DepositRule } from "./deposit";
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
};

const relId = (v: unknown): string | null => (v === null || v === undefined ? null : typeof v === "object" ? String((v as { id: unknown }).id) : String(v));

export async function loadCheckoutContext(payload: Payload, env: Record<string, string | undefined> = process.env): Promise<CheckoutContext> {
  const [settings, classes] = await Promise.all([
    payload.findGlobal({ slug: "checkout-settings", depth: 0, overrideAccess: true }) as Promise<CheckoutSetting>,
    payload.find({ collection: "tax-classes", limit: 100, depth: 0, overrideAccess: true }),
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

async function loadProducts(payload: Payload, ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const { docs } = await payload.find({
    collection: "products",
    where: { and: [{ id: { in: ids } }, { _status: { equals: "published" } }] },
    limit: ids.length,
    depth: 0,
    overrideAccess: false,
  });
  return docs as Product[];
}

export async function priceBag(payload: Payload, token: string | undefined, ctx: CheckoutContext): Promise<PricedCart> {
  const lines = await readCartLines(payload, token);
  const products = await loadProducts(payload, [...new Set(lines.map((l) => l.unitId.split(":")[0]))]);
  return priceCart(lines, products, { previewStock: previewStockEnabled(), taxClasses: ctx.taxClasses, defaultTaxClassId: ctx.defaultTaxClassId });
}

/** Add, set or remove a bag line. Only purchasable units are accepted; quantities are clamped. */
export async function changeBag(
  payload: Payload,
  token: string,
  change: { unitId: string; quantity: number; mode: "add" | "set" },
  ctx: CheckoutContext,
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
  const priced = priceCart([{ unitId, quantity: next }], await loadProducts(payload, [unitId.split(":")[0]]), {
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

async function nextNumber(payload: Payload, collection: "orders" | "reservations"): Promise<string> {
  const { totalDocs } = await payload.count({ collection, overrideAccess: true });
  return formatNumber(collection === "orders" ? "SP" : "SPR", totalDocs + 1);
}

async function findByKey(payload: Payload, collection: "orders" | "reservations", key: string) {
  return (await payload.find({ collection, where: { idempotencyKey: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] ?? null;
}

/**
 * Creates the record once per idempotency key with the next free number. If a simultaneous
 * duplicate submission won the race, its record is returned instead; if two different submissions
 * raced for the same number, the loser retries with the next one.
 */
async function createOnce<T>(payload: Payload, collection: "orders" | "reservations", key: string, data: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const existing = await findByKey(payload, collection, key);
    if (existing) return existing as T;
    const number = await nextNumber(payload, collection);
    try {
      return (await payload.create({ collection, data: { ...data, idempotencyKey: key, number } as never, overrideAccess: true })) as T;
    } catch (e) {
      if (attempt >= 4) throw e;
    }
  }
}

export type PlaceResult = { ok: true; number: string; token: string } | { ok: false; error: string };

// ---------------------------------------------------------------- shop orders

export async function placeOrder(
  payload: Payload,
  input: { cartToken: string | undefined; form: Record<string, unknown>; now?: Date },
  ctx: CheckoutContext,
): Promise<PlaceResult> {
  const now = input.now ?? new Date();
  const state = orderingState(ctx.provider, false);
  if (!state.open) return { ok: false, error: "Online payment is coming soon. Please call us to order." };

  const bag = await priceBag(payload, input.cartToken, ctx);
  if (!bag.payable.length) return { ok: false, error: "Your bag is empty." };
  if (bag.blocking) return { ok: false, error: "Some items in your bag aren't available. Please review your bag." };

  const contact = parseContact(input.form);
  if (!contact.ok) return contact;
  const slot = pickSlot(ctx, now, input.form.pickup, ctx.pickup.leadTimeHours);
  if (!slot) return { ok: false, error: "That pickup time is no longer available. Please choose another." };
  const notes = String(input.form.notes ?? "").trim().slice(0, 500);

  const key = idempotencyKey("order", hashToken(input.cartToken ?? ""), bag.payable.map((l) => [l.unitId, l.quantity, l.unitPriceCents]), contact.contact, slot, notes);
  const token = urlToken("order", key);
  let order = await createOnce<Order>(payload, "orders", key, {
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
  });
  if (order.paymentStatus !== "paid") {
    const charge = await ctx.provider!.charge({ reference: order.number, amountCents: order.totals.totalCents, idempotencyKey: key });
    order = await payload.update({
      collection: "orders",
      id: order.id,
      data: { paymentStatus: charge.status, payment: { provider: ctx.provider!.id, reference: charge.reference } },
      overrideAccess: true,
    });
    if (charge.status !== "paid") return { ok: false, error: "The payment didn't go through. Your bag is saved — please try again." };
    console.info(`[order] ${order.number} placed${order.testMode ? " (test)" : ""}; confirmation email not configured yet`);
  }
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
  packagingCents: number;
  contentsCents: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  taxApproved: boolean;
};

/** Re-validates a basket with fresh prices and stock, and works out its tax (D36). */
export async function priceBasket(payload: Payload, draft: BasketDraft, ctx: CheckoutContext): Promise<PricedBasket | { ok: false; error: string }> {
  const { settings, products, display } = await loadBuilderCatalogFrom(payload);
  const validation = validateGift(draft.request, settings, catalogOf(products));
  if (!validation.complete) {
    return { ok: false, error: validation.violations[0]?.message ?? "This basket isn't complete yet. Please go back and finish it." };
  }
  const priceOf = new Map(products.map((p) => [p.id, p.priceCents ?? 0]));
  const nameOf = new Map(display.map((d) => [d.id, d.title]));
  const components: BasketComponent[] = draft.request.selections
    .filter((s) => s.quantity > 0)
    .map((s) => ({ productId: s.productId, name: nameOf.get(s.productId) ?? s.productId, quantity: s.quantity, unitPriceCents: priceOf.get(s.productId) ?? 0 }));

  const productDocs = await loadProducts(payload, [...new Set(components.map((c) => c.productId.split(":")[0]))]);
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

  const basket = await priceBasket(payload, input.draft, ctx);
  if (!basket.ok) return basket;
  const contact = parseContact(input.form);
  if (!contact.ok) return contact;
  const slot = pickSlot(ctx, now, input.form.pickup, ctx.reservationLeadHours);
  if (!slot) return { ok: false, error: "That pickup time is no longer available. Please choose another." };
  const payInFull = input.form.payment === "full";
  if (payInFull && !ctx.allowPayInFull) return { ok: false, error: "Please choose the deposit option." };

  const plan = paymentPlan(basket.totalCents, ctx.deposit, payInFull);
  const key = idempotencyKey("reservation", input.draft, contact.contact, slot, payInFull, basket.totalCents);
  const token = urlToken("reservation", key);
  let reservation = await createOnce<Reservation>(payload, "reservations", key, {
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
    depositCents: plan.paidInFull ? basket.totalCents : plan.chargeNowCents,
    amountPaidCents: 0,
    balanceDueCents: basket.totalCents,
  });
  if (reservation.paymentStatus === "deposit_pending" || reservation.paymentStatus === "failed") {
    const charge = await ctx.provider!.charge({ reference: reservation.number, amountCents: plan.chargeNowCents, idempotencyKey: key });
    reservation = await payload.update({
      collection: "reservations",
      id: reservation.id,
      data:
        charge.status === "paid"
          ? {
              paymentStatus: plan.paidInFull ? "paid_in_full" : "deposit_paid",
              amountPaidCents: plan.chargeNowCents,
              balanceDueCents: plan.balanceDueCents,
              payment: { provider: ctx.provider!.id, reference: charge.reference },
            }
          : { paymentStatus: "failed", payment: { provider: ctx.provider!.id, reference: charge.reference } },
      overrideAccess: true,
    });
    if (charge.status !== "paid") return { ok: false, error: "The payment didn't go through. Please try again." };
    console.info(`[reservation] ${reservation.number} reserved${reservation.testMode ? " (test)" : ""}; confirmation email not configured yet`);
  }
  return { ok: true, number: reservation.number, token };
}

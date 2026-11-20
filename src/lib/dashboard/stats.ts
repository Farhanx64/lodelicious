import "server-only";

import type { Payload } from "payload";

/** The figures the staff dashboard shows. Live orders only: test orders and unpaid ones are left out. */
export type DashboardStats = {
  days: { date: string; label: string; revenueCents: number; orders: number }[];
  statuses: { key: string; label: string; count: number }[];
  topProducts: { name: string; quantity: number; revenueCents: number }[];
  revenue30Cents: number;
  orders30: number;
  averageCents: number;
  toPack: number;
};

const STATUS_LABELS: Record<string, string> = {
  staff_review: "Needs review",
  preparing: "Preparing",
  ready: "Ready for pickup",
  shipped: "Shipped",
  completed: "Completed",
};

const DAYS = 30;

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });

type Line = { name?: string; title?: string; quantity?: number; unitPriceCents?: number; lineTotalCents?: number };

export async function dashboardStats(payload: Payload, now = new Date()): Promise<DashboardStats> {
  const since = new Date(now.getTime() - DAYS * 86_400_000);
  const { docs } = await payload.find({
    collection: "orders",
    where: { and: [{ createdAt: { greater_than_equal: since.toISOString() } }, { testMode: { not_equals: true } }, { paymentStatus: { equals: "paid" } }] },
    limit: 5000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { createdAt: true, fulfillmentStatus: true, totals: true, lines: true },
  });

  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(now.getTime() - (DAYS - 1 - i) * 86_400_000);
    return { date: dayKey(d), label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }), revenueCents: 0, orders: 0 };
  });
  const byDay = new Map(days.map((d) => [d.date, d]));
  const statusCounts = new Map<string, number>();
  const products = new Map<string, { name: string; quantity: number; revenueCents: number }>();
  let revenue = 0;

  for (const o of docs) {
    const total = Number(o.totals?.totalCents ?? 0);
    revenue += total;
    const day = byDay.get(dayKey(new Date(o.createdAt)));
    if (day) {
      day.revenueCents += total;
      day.orders += 1;
    }
    const s = String(o.fulfillmentStatus ?? "");
    if (STATUS_LABELS[s]) statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
    for (const l of (Array.isArray(o.lines) ? o.lines : []) as Line[]) {
      const name = String(l.title ?? l.name ?? "Item").trim();
      const qty = Number(l.quantity ?? 1);
      const p = products.get(name) ?? { name, quantity: 0, revenueCents: 0 };
      p.quantity += qty;
      p.revenueCents += Number(l.lineTotalCents ?? (l.unitPriceCents ?? 0) * qty);
      products.set(name, p);
    }
  }

  return {
    days,
    statuses: Object.entries(STATUS_LABELS).map(([key, label]) => ({ key, label, count: statusCounts.get(key) ?? 0 })),
    topProducts: [...products.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    revenue30Cents: revenue,
    orders30: docs.length,
    averageCents: docs.length ? Math.round(revenue / docs.length) : 0,
    toPack: (statusCounts.get("staff_review") ?? 0) + (statusCounts.get("preparing") ?? 0),
  };
}

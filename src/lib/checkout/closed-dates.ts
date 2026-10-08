/**
 * The shop's standing closures as explicit dates (D41, audit A07). PRD FUL 01 (confirmed): closed
 * December 25, January 1 and Labor Day. Checkout's `closedDates` list holds plain YYYY-MM-DD dates
 * (no recurring rules, which would need a schema change), so the catalog seed fills the list, only
 * while it is empty, with every occurrence in the next 18 months. Lody adds later years in
 * /admin → Checkout settings → Closed dates.
 */
import { SHOP_TZ } from "./pickup";

export type ClosedDate = { date: string; label: string };

/** How far ahead the seed fills in. Longer than the booking window so the list isn't empty again after a year. */
export const CLOSED_DATE_MONTHS = 18;

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** The first Monday of September: Labor Day in the United States. */
export function laborDay(year: number): string {
  const dayOfWeek = new Date(Date.UTC(year, 8, 1)).getUTCDay(); // 0 = Sunday
  return iso(year, 9, ((1 - dayOfWeek + 7) % 7) + 1);
}

/** Today's date in the shop's time zone, as YYYY-MM-DD. */
function shopToday(now: Date, tz: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** The same calendar day `months` later (clamped to the end of a shorter month). */
function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return iso(target.getUTCFullYear(), target.getUTCMonth() + 1, Math.min(d, lastDay));
}

/** December 25, January 1 and Labor Day from today (inclusive) through `months` months ahead, oldest first. */
export function defaultClosedDates(now: Date, { months = CLOSED_DATE_MONTHS, tz = SHOP_TZ }: { months?: number; tz?: string } = {}): ClosedDate[] {
  const today = shopToday(now, tz);
  const last = addMonths(today, months);
  const year = Number(today.slice(0, 4));
  const all: ClosedDate[] = [];
  for (let y = year; y <= year + Math.ceil(months / 12) + 1; y++) {
    all.push({ date: iso(y, 1, 1), label: "New Year's Day" }, { date: laborDay(y), label: "Labor Day" }, { date: iso(y, 12, 25), label: "Christmas Day" });
  }
  return all.filter((c) => c.date >= today && c.date <= last).sort((a, b) => a.date.localeCompare(b.date));
}

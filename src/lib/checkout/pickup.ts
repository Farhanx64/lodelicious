/**
 * Pickup times customers may choose (PRD FUL 02): inside configured opening hours, after the lead
 * time, within the booking window, never on a closed date. All times are the shop's local time.
 */
export const SHOP_TZ = "America/New_York";

export type PickupSettings = {
  hours: { weekday: number; open: string; close: string }[]; // weekday 0 = Sunday
  slotMinutes: number;
  leadTimeHours: number;
  daysAhead: number;
  closedDates: string[]; // YYYY-MM-DD
};

export type Slot = { date: string; start: string; end: string };

const minutes = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new RangeError(`Not a time: ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
};
const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/** Wall-clock parts of an instant in a time zone. */
function zoned(instant: Date, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return { y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour, mi: +parts.minute, s: +parts.second };
}

/** The UTC instant of a local wall-clock time in `tz` (DST-safe). */
export function zonedToUtc(date: string, time: string, tz = SHOP_TZ): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const mins = minutes(time);
  const guess = Date.UTC(y, mo - 1, d, Math.floor(mins / 60), mins % 60);
  const offsetAt = (t: number) => {
    const z = zoned(new Date(t), tz);
    return Date.UTC(z.y, z.m - 1, z.d, z.h, z.mi, z.s) - t;
  };
  let utc = guess - offsetAt(guess);
  utc = guess - offsetAt(utc);
  return new Date(utc);
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function availableSlots(settings: PickupSettings, now: Date, leadTimeHours = settings.leadTimeHours, tz = SHOP_TZ): Slot[] {
  const today = zoned(now, tz);
  const start = `${today.y}-${String(today.m).padStart(2, "0")}-${String(today.d).padStart(2, "0")}`;
  const earliest = now.getTime() + leadTimeHours * 3_600_000;
  const closed = new Set(settings.closedDates);
  const step = Math.max(15, settings.slotMinutes);
  const slots: Slot[] = [];
  for (let i = 0; i <= settings.daysAhead; i++) {
    const date = addDays(start, i);
    if (closed.has(date)) continue;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    for (const h of settings.hours.filter((x) => x.weekday === weekday)) {
      for (let t = minutes(h.open); t + step <= minutes(h.close); t += step) {
        if (zonedToUtc(date, hhmm(t), tz).getTime() < earliest) continue;
        slots.push({ date, start: hhmm(t), end: hhmm(t + step) });
      }
    }
  }
  return slots;
}

export function isAvailableSlot(settings: PickupSettings, now: Date, slot: { date: string; start: string }, leadTimeHours = settings.leadTimeHours): Slot | null {
  return availableSlots(settings, now, leadTimeHours).find((s) => s.date === slot.date && s.start === slot.start) ?? null;
}

export function formatSlot(slot: Slot): string {
  const day = new Date(`${slot.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const t = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  };
  return `${day}, ${t(slot.start)}–${t(slot.end)}`;
}

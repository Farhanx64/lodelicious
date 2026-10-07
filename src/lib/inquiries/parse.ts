/**
 * Parsing and validation of the two inquiry forms (D37). Pure: takes the submitted fields and
 * "now", returns either clean data, a friendly error, or "bot" for a honeypot hit. Nothing here
 * trusts the browser: topics come from an allow-list, text is stripped of control characters and
 * length-checked, the date and guest count are re-validated, and any estimate sent along is
 * simply never read.
 */
import { parseContact, type ContactInput } from "../checkout/service";
import { SHOP_TZ } from "../checkout/pickup";
import { parseGuests, MAX_GUESTS, MIN_GUESTS } from "./estimate";
import { HONEYPOT_FIELD, MAX_LOCATION_LENGTH, MAX_MESSAGE_LENGTH, isContactTopic, type InquiryTopic } from "./shared";

export type EventDetails = { date: string; location: string; guests: number; setupTime: string };

export type ParsedInquiry = {
  topic: InquiryTopic;
  customer: ContactInput;
  message: string;
  /** A well-formed product slug from `?item=`, or null. The service checks it against published products. */
  itemSlug: string | null;
  /** Only for the fountain. */
  event: EventDetails | null;
};

export type ParseResult = { status: "ok"; inquiry: ParsedInquiry } | { status: "bot" } | { status: "invalid"; error: string };

type Form = Record<string, unknown>;
type Options = { now: Date; timeZone?: string };

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩﻿]/g;

/** One line of text: control and invisible direction characters removed, whitespace collapsed. */
export function cleanLine(raw: unknown): string {
  return String(raw ?? "").replace(CONTROL, "").replace(/\s+/g, " ").trim();
}

/** Free text: control characters removed, line breaks kept (as \n), at most two blank lines in a row. */
export function cleanText(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const isHoneypotTripped = (form: Form): boolean => String(form[HONEYPOT_FIELD] ?? "").trim() !== "";

/** A product slug as the catalog writes them. Anything else is ignored, not an error. */
export function parseItemSlug(raw: unknown): string | null {
  const slug = String(raw ?? "").trim();
  return slug.length > 0 && slug.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}

/** Today's date (YYYY-MM-DD) on the wall clock of `timeZone`. */
export function todayIn(now: Date, timeZone: string = SHOP_TZ): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** How far ahead an event date may be. A sanity bound against typos like 2062, not a booking window. */
export const MAX_YEARS_AHEAD = 3;

const isCalendarDate = (value: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
};

/** The event date as YYYY-MM-DD: a real calendar date, today or later in the shop's time zone. */
export function parseEventDate(raw: unknown, now: Date, timeZone: string = SHOP_TZ): { ok: true; date: string } | { ok: false; error: string } {
  const value = String(raw ?? "").trim();
  if (!value) return { ok: false, error: "Please choose the date of your event." };
  if (!isCalendarDate(value)) return { ok: false, error: "Please enter the event date as a real date." };
  const today = todayIn(now, timeZone);
  if (value < today) return { ok: false, error: "The event date can't be in the past." };
  const [y, m, d] = today.split("-");
  if (value > `${Number(y) + MAX_YEARS_AHEAD}-${m}-${d}`) return { ok: false, error: `Please choose a date within the next ${MAX_YEARS_AHEAD} years.` };
  return { ok: true, date: value };
}

/** A 24-hour clock time such as 14:30, as an `<input type="time">` submits it. */
export function parseSetupTime(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}

const invalid = (error: string): ParseResult => ({ status: "invalid", error });

function parseCustomer(form: Form): { ok: true; customer: ContactInput } | { ok: false; error: string } {
  const result = parseContact({ name: cleanLine(form.name), email: cleanLine(form.email), phone: cleanLine(form.phone) });
  return result.ok ? { ok: true, customer: result.contact } : result;
}

function parseMessage(raw: unknown, required: boolean): { ok: true; message: string } | { ok: false; error: string } {
  const message = cleanText(raw);
  if (!message && required) return { ok: false, error: "Please tell us how we can help." };
  if (message.length > MAX_MESSAGE_LENGTH) return { ok: false, error: `Please keep your message under ${MAX_MESSAGE_LENGTH} characters.` };
  return { ok: true, message };
}

/** The general form on /contact. The fountain topic is not accepted here: it has its own form and estimate. */
export function parseContactInquiry(form: Form): ParseResult {
  if (isHoneypotTripped(form)) return { status: "bot" };

  const topic = String(form.topic ?? "");
  if (topic === "fountain") return invalid("Chocolate fountain requests are made on our Events page.");
  if (!isContactTopic(topic)) return invalid("Please choose what your message is about.");
  const customer = parseCustomer(form);
  if (!customer.ok) return invalid(customer.error);
  const message = parseMessage(form.message, true);
  if (!message.ok) return invalid(message.error);

  return { status: "ok", inquiry: { topic, customer: customer.customer, message: message.message, itemSlug: parseItemSlug(form.item), event: null } };
}

/** The chocolate-fountain form on /events. The topic is always `fountain`, whatever the browser sent. */
export function parseFountainInquiry(form: Form, opts: Options): ParseResult {
  if (isHoneypotTripped(form)) return { status: "bot" };

  const date = parseEventDate(form.eventDate, opts.now, opts.timeZone);
  if (!date.ok) return invalid(date.error);
  const setupTime = parseSetupTime(form.setupTime);
  if (!setupTime) return invalid("Please choose the time you'd like us to set up (for example 2:30 PM).");
  const location = cleanLine(form.location);
  if (!location) return invalid("Please tell us where the event will be.");
  if (location.length > MAX_LOCATION_LENGTH) return invalid(`Please keep the location under ${MAX_LOCATION_LENGTH} characters.`);
  const guests = parseGuests(form.guests);
  if (guests === null) return invalid(`Please enter the number of guests as a whole number from ${MIN_GUESTS} to ${MAX_GUESTS}.`);
  const customer = parseCustomer(form);
  if (!customer.ok) return invalid(customer.error);
  const message = parseMessage(form.message, false);
  if (!message.ok) return invalid(message.error);

  return {
    status: "ok",
    inquiry: { topic: "fountain", customer: customer.customer, message: message.message, itemSlug: null, event: { date: date.date, location, guests, setupTime } },
  };
}

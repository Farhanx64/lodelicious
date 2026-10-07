import { describe, expect, it } from "vitest";

import { cleanLine, cleanText, parseContactInquiry, parseEventDate, parseFountainInquiry, parseItemSlug, parseSetupTime, todayIn } from "./parse";
import { HONEYPOT_FIELD, MAX_MESSAGE_LENGTH } from "./shared";

// 22:00 on Monday 2026-10-05 in Plymouth (UTC-4), but already 2026-10-06 in UTC.
const NOW = new Date("2026-10-06T02:00:00Z");
const OPTS = { now: NOW };
const CONTACT = { name: "Pat Customer", email: "pat@example.test", phone: "(508) 555-0100" };
const GENERAL = { ...CONTACT, topic: "general", message: "Do you have gluten-free fudge?" };
const FOUNTAIN = { ...CONTACT, eventDate: "2026-12-12", setupTime: "14:30", location: "Plymouth Yacht Club, 11 Union St", guests: "60", message: "" };

describe("text cleaning", () => {
  it("strips control and invisible direction characters, and collapses one-line whitespace", () => {
    expect(cleanLine("  Pat\u0000 \n\tCustomer‮ ")).toBe("Pat Customer");
    expect(cleanText("Hello\r\n\r\n\r\n\r\nthere\u0007 ​")).toBe("Hello\n\nthere");
  });

  it("keeps ordinary punctuation, accents and emoji", () => {
    expect(cleanLine("Zoë O’Brien 🍫")).toBe("Zoë O’Brien 🍫");
  });

  it("leaves markup alone: output is escaped by React, never trusted as HTML", () => {
    expect(cleanText("<script>alert(1)</script>")).toBe("<script>alert(1)</script>");
  });
});

describe("parseItemSlug", () => {
  it("accepts catalog-style slugs and ignores everything else", () => {
    expect(parseItemSlug("phillips-smores-bar")).toBe("phillips-smores-bar");
    for (const bad of ["", "Has Spaces", "../../etc/passwd", "a/b", "UPPER", "-lead", "trail-", "x".repeat(121), null, undefined, { a: 1 }]) expect(parseItemSlug(bad)).toBeNull();
  });
});

describe("event date (shop time zone America/New_York)", () => {
  it("uses the shop's calendar day, not UTC's", () => {
    expect(todayIn(NOW)).toBe("2026-10-05");
    expect(todayIn(new Date("2026-01-15T04:59:00Z"))).toBe("2026-01-14");
    expect(todayIn(new Date("2026-01-15T05:00:00Z"))).toBe("2026-01-15");
  });

  it("accepts today and later, rejects yesterday", () => {
    expect(parseEventDate("2026-10-05", NOW)).toEqual({ ok: true, date: "2026-10-05" });
    expect(parseEventDate("2026-10-06", NOW)).toEqual({ ok: true, date: "2026-10-06" });
    expect(parseEventDate("2026-10-04", NOW)).toMatchObject({ ok: false, error: expect.stringMatching(/past/) });
    expect(parseEventDate("2025-12-31", NOW)).toMatchObject({ ok: false });
  });

  it("rejects things that are not real dates", () => {
    for (const bad of ["", "tomorrow", "2026-13-01", "2026-02-30", "2027-2-3", "12/12/2026", "2026-12-12T10:00", "2026-12-12x", null, undefined]) {
      expect(parseEventDate(bad, NOW).ok).toBe(false);
    }
  });

  it("rejects year typos far in the future", () => {
    expect(parseEventDate("2062-06-01", NOW)).toMatchObject({ ok: false });
    expect(parseEventDate("2029-10-05", NOW)).toMatchObject({ ok: true });
    expect(parseEventDate("2029-10-06", NOW)).toMatchObject({ ok: false });
  });
});

describe("setup time", () => {
  it("is a 24-hour HH:MM clock time", () => {
    expect(parseSetupTime("14:30")).toBe("14:30");
    expect(parseSetupTime("00:00")).toBe("00:00");
    for (const bad of ["24:00", "9:30", "14:60", "2pm", "", null]) expect(parseSetupTime(bad)).toBeNull();
  });
});

describe("general inquiry form", () => {
  it("accepts a valid question", () => {
    expect(parseContactInquiry({ ...GENERAL, item: "phillips-smores-bar" })).toEqual({
      status: "ok",
      inquiry: { topic: "general", customer: CONTACT, message: "Do you have gluten-free fudge?", itemSlug: "phillips-smores-bar", event: null },
    });
  });

  it("only accepts topics from the allow-list", () => {
    for (const topic of ["gift_basket", "gift_box", "baby_white", "cowboy", "filled_ceramic", "custom_request"]) {
      expect(parseContactInquiry({ ...GENERAL, topic })).toMatchObject({ status: "ok" });
    }
    for (const topic of ["", "refund", "GENERAL", "constructor", undefined]) expect(parseContactInquiry({ ...GENERAL, topic })).toMatchObject({ status: "invalid" });
  });

  it("sends fountain requests to the Events page, where the estimate is computed", () => {
    expect(parseContactInquiry({ ...GENERAL, topic: "fountain" })).toMatchObject({ status: "invalid", error: expect.stringMatching(/Events page/) });
  });

  it("requires a name, a valid email, a reachable phone and a message", () => {
    expect(parseContactInquiry({ ...GENERAL, name: "  " })).toMatchObject({ status: "invalid", error: expect.stringMatching(/name/) });
    expect(parseContactInquiry({ ...GENERAL, email: "not-an-email" })).toMatchObject({ status: "invalid", error: expect.stringMatching(/email/) });
    expect(parseContactInquiry({ ...GENERAL, email: "pat@example.test\nBcc: x@y.z" })).toMatchObject({ status: "invalid" });
    expect(parseContactInquiry({ ...GENERAL, phone: "555" })).toMatchObject({ status: "invalid", error: expect.stringMatching(/phone/) });
    expect(parseContactInquiry({ ...GENERAL, message: "   " })).toMatchObject({ status: "invalid", error: expect.stringMatching(/how we can help/) });
  });

  it("limits the message length and the name", () => {
    expect(parseContactInquiry({ ...GENERAL, message: "x".repeat(MAX_MESSAGE_LENGTH) })).toMatchObject({ status: "ok" });
    expect(parseContactInquiry({ ...GENERAL, message: "x".repeat(MAX_MESSAGE_LENGTH + 1) })).toMatchObject({ status: "invalid" });
    const long = parseContactInquiry({ ...GENERAL, name: "N".repeat(500) });
    expect(long.status === "ok" && long.inquiry.customer.name.length).toBe(100);
  });

  it("never lets a line break into the name", () => {
    const parsed = parseContactInquiry({ ...GENERAL, name: "Pat\r\nBcc: attacker@example.test" });
    expect(parsed.status === "ok" && parsed.inquiry.customer.name).toBe("Pat Bcc: attacker@example.test");
  });

  it("ignores a malformed item slug rather than failing", () => {
    expect(parseContactInquiry({ ...GENERAL, item: "../../x" })).toMatchObject({ status: "ok", inquiry: { itemSlug: null } });
  });

  it("drops a honeypot hit silently, before any validation", () => {
    expect(parseContactInquiry({ ...GENERAL, [HONEYPOT_FIELD]: "https://spam.example" })).toEqual({ status: "bot" });
    expect(parseContactInquiry({ [HONEYPOT_FIELD]: "x" })).toEqual({ status: "bot" });
    expect(parseContactInquiry({ ...GENERAL, [HONEYPOT_FIELD]: "   " })).toMatchObject({ status: "ok" });
  });
});

describe("fountain inquiry form", () => {
  it("accepts a valid request and always uses the fountain topic", () => {
    const parsed = parseFountainInquiry({ ...FOUNTAIN, topic: "general", estimateCents: "1" }, OPTS);
    expect(parsed).toEqual({
      status: "ok",
      inquiry: {
        topic: "fountain",
        customer: CONTACT,
        message: "",
        itemSlug: null,
        event: { date: "2026-12-12", location: "Plymouth Yacht Club, 11 Union St", guests: 60, setupTime: "14:30" },
      },
    });
  });

  it("collects date, location, guests and setup time", () => {
    expect(parseFountainInquiry({ ...FOUNTAIN, eventDate: "" }, OPTS)).toMatchObject({ status: "invalid", error: expect.stringMatching(/date/) });
    expect(parseFountainInquiry({ ...FOUNTAIN, setupTime: "" }, OPTS)).toMatchObject({ status: "invalid", error: expect.stringMatching(/set up/) });
    expect(parseFountainInquiry({ ...FOUNTAIN, location: "  " }, OPTS)).toMatchObject({ status: "invalid", error: expect.stringMatching(/where/) });
    expect(parseFountainInquiry({ ...FOUNTAIN, guests: "" }, OPTS)).toMatchObject({ status: "invalid", error: expect.stringMatching(/guests/) });
  });

  it("rejects past dates and bad guest counts", () => {
    expect(parseFountainInquiry({ ...FOUNTAIN, eventDate: "2026-10-04" }, OPTS)).toMatchObject({ status: "invalid", error: expect.stringMatching(/past/) });
    expect(parseFountainInquiry({ ...FOUNTAIN, eventDate: "2026-10-05" }, OPTS)).toMatchObject({ status: "ok" });
    for (const guests of ["0", "1001", "12.5", "-4", "lots"]) expect(parseFountainInquiry({ ...FOUNTAIN, guests }, OPTS)).toMatchObject({ status: "invalid" });
    for (const guests of ["1", "1000"]) expect(parseFountainInquiry({ ...FOUNTAIN, guests }, OPTS)).toMatchObject({ status: "ok" });
  });

  it("limits the location length", () => {
    expect(parseFountainInquiry({ ...FOUNTAIN, location: "x".repeat(301) }, OPTS)).toMatchObject({ status: "invalid" });
  });

  it("requires valid contact details", () => {
    expect(parseFountainInquiry({ ...FOUNTAIN, email: "nope" }, OPTS)).toMatchObject({ status: "invalid" });
    expect(parseFountainInquiry({ ...FOUNTAIN, phone: "12" }, OPTS)).toMatchObject({ status: "invalid" });
  });

  it("drops a honeypot hit silently", () => {
    expect(parseFountainInquiry({ ...FOUNTAIN, [HONEYPOT_FIELD]: "buy now" }, OPTS)).toEqual({ status: "bot" });
  });
});

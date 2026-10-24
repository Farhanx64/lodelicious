import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DRAFT_BANNER_TITLE,
  PENDING_MESSAGE,
  POLICIES,
  POLICY_SLUGS,
  formatReviewed,
  getPolicyDefinition,
  policyStatusLabel,
  resolveAllPolicies,
  resolvePolicy,
  toParagraphs,
  type ContactFacts,
  type StoredPolicies,
} from "./policies";

const contact: ContactFacts = { street: "24 Manomet Point Rd.", locality: "Plymouth, MA 02360", phone: "(774) 283-4676", email: "lodelicious1@gmail.com" };
const live = { staging: false, contact };
const staging = { staging: true, contact };

const approvedPickup: StoredPolicies = {
  pickupAndDelivery: { title: "Collecting your order", body: "First paragraph.\n\nSecond paragraph.", approved: true, lastReviewed: "2026-10-06T12:00:00.000Z" },
};

describe("the policy list", () => {
  it("has the five fixed slugs, each with a definition and its own admin group", () => {
    expect([...POLICY_SLUGS].sort()).toEqual(["cancellations-and-refunds", "damaged-or-missing-items", "pickup-and-delivery", "privacy", "substitutions-and-dietary-requests"]);
    expect(POLICIES.map((p) => p.slug)).toEqual([...POLICY_SLUGS]);
    expect(new Set(POLICIES.map((p) => p.field)).size).toBe(POLICIES.length);
    for (const p of POLICIES) {
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.summary.length).toBeGreaterThan(0);
      expect(p.openTerms.length).toBeGreaterThan(0);
    }
  });

  it("looks policies up by slug and returns undefined for anything else", () => {
    expect(getPolicyDefinition("privacy")?.title).toBe("Privacy");
    for (const bad of ["", "nope", "Privacy", "__proto__", "constructor", "privacy/", "toString"]) expect(getPolicyDefinition(bad)).toBeUndefined();
  });
});

describe("draft wording invents no terms", () => {
  const draftOf = (slug: string, c: ContactFacts = contact) => getPolicyDefinition(slug)!.draft(c);

  it("has no prices, percentages or deadlines other than the cookie lifetimes the code sets", () => {
    // Digits that belong to the shop's own address or phone come from Store settings, not the draft.
    const withoutContact = (text: string) => text.replaceAll(contact.street, "").replaceAll(contact.locality, "").replaceAll(contact.phone, "");
    const allowed: Record<string, string[]> = { privacy: ["30", "2"] };
    for (const p of POLICIES) {
      const text = withoutContact(p.draft(contact));
      expect(text, p.slug).not.toMatch(/[$%]/);
      expect(text.match(/\d+/g) ?? [], p.slug).toEqual(allowed[p.slug] ?? []);
      expect(text, p.slug).not.toMatch(/business days?|within (one|two|three|\d+) (hour|day|week|month)s?|free cancellation/i);
    }
  });

  it("says plainly that unresolved terms are being finalised and sends the customer to the shop", () => {
    for (const slug of ["cancellations-and-refunds", "damaged-or-missing-items", "privacy"]) {
      expect(draftOf(slug), slug).toMatch(/being finalised/);
      expect(draftOf(slug), slug).toMatch(/contact the shop|contact us/i);
    }
    expect(draftOf("cancellations-and-refunds")).toMatch(/Whether the deposit can be refunded is being finalised/);
    expect(draftOf("damaged-or-missing-items")).toMatch(/deadline for reporting a problem/);
  });

  it("states only the confirmed pickup, delivery and shipping facts", () => {
    const text = draftOf("pickup-and-delivery");
    expect(text).toContain("Pickup is free at 24 Manomet Point Rd., Plymouth, MA 02360.");
    expect(text).toMatch(/takes about an hour, depending on how busy/);
    expect(text).toMatch(/cannot promise that an order will be ready within an hour/);
    expect(text).toMatch(/Local delivery is through DoorDash/);
    expect(text).toMatch(/Shipping is not available through this website/);
    expect(text).not.toMatch(/five miles|\$25|cutoff/i);
  });

  it("points to the DoorDash page only when the link is set", () => {
    expect(draftOf("pickup-and-delivery")).toMatch(/not published on this website yet/);
    const withLink = draftOf("pickup-and-delivery", { ...contact, doordashUrl: "https://www.doordash.com/store/example" });
    expect(withLink).toMatch(/order delivery on the shop’s DoorDash page/);
    expect(withLink).not.toMatch(/not published/);
  });

  it("keeps the substitution, dietary and refund wording to what the PRD confirms", () => {
    const sub = draftOf("substitutions-and-dietary-requests");
    expect(sub).toMatch(/contact you before making the change/);
    expect(sub).toMatch(/not guarantees/);
    const refunds = draftOf("cancellations-and-refunds");
    expect(refunds).toMatch(/reviewed by shop staff/);
    expect(refunds).toMatch(/Nothing is booked or charged on this website/);
  });

  it("describes only data and cookies the code really handles", () => {
    const text = draftOf("privacy");
    expect(text).toMatch(/name, email address and phone number/);
    expect(text).toMatch(/third-party trackers or analytics/);
    expect(text).toMatch(/do not store card numbers/);
    // Retention, sharing and deletion are not decided, so the draft must not promise any of them.
    expect(text).not.toMatch(/never sell|do not sell|we delete|deleted after|for \d+ (days|months|years)/i);
    expect(text).not.toMatch(/confirmation email|we will email/i);
  });

  it("keeps the cookie lifetimes in step with the session code", () => {
    const session = fs.readFileSync(path.resolve("src/lib/checkout/session.ts"), "utf8");
    expect(session).toContain("maxAge: 60 * 60 * 24 * 30"); // bag cookie: 30 days
    expect(session).toContain("maxAge: 2 * 60 * 60"); // basket cookie: 2 hours
    expect(draftOf("privacy")).toMatch(/up to 30 days/);
    expect(draftOf("privacy")).toMatch(/lasts 2 hours/);
  });

  it("shows the allergy notice under the dietary policy only", () => {
    expect(POLICIES.filter((p) => p.showsAllergyNotice).map((p) => p.slug)).toEqual(["substitutions-and-dietary-requests"]);
  });
});

describe("resolvePolicy: live", () => {
  it("shows approved stored text, with its own title and review date", () => {
    const r = resolvePolicy("pickup-and-delivery", approvedPickup, live)!;
    expect(r).toMatchObject({ view: "approved", title: "Collecting your order", banner: false, lastReviewed: "2026-10-06T12:00:00.000Z", openTerms: [] });
    expect(r.paragraphs).toEqual(["First paragraph.", "Second paragraph."]);
  });

  it("shows only the being-finalised message when the stored text is not approved", () => {
    const stored: StoredPolicies = { privacy: { title: "My privacy title", body: "Unapproved text.", approved: false } };
    const r = resolvePolicy("privacy", stored, live)!;
    expect(r).toMatchObject({ view: "pending", title: "Privacy", paragraphs: [], banner: false, lastReviewed: null, openTerms: [] });
    expect(JSON.stringify(r)).not.toContain("Unapproved text");
    expect(PENDING_MESSAGE).toBe("This policy is being finalised. Please contact us with any questions.");
  });

  it("never shows the built-in draft: nothing stored means being finalised", () => {
    for (const stored of [undefined, null, {}, { privacy: null }, { privacy: {} }, { privacy: { body: "", approved: true } }]) {
      const r = resolvePolicy("privacy", stored as StoredPolicies, live)!;
      expect(r.view).toBe("pending");
      expect(r.paragraphs).toEqual([]);
      expect(r.banner).toBe(false);
    }
  });

  it("treats an approved policy with a blank body as not approved", () => {
    expect(resolvePolicy("privacy", { privacy: { body: "  \n\n  ", approved: true } }, live)!.view).toBe("pending");
  });

  it("ignores another policy's approval", () => {
    expect(resolvePolicy("privacy", approvedPickup, live)!.view).toBe("pending");
  });
});

describe("resolvePolicy: staging and local", () => {
  it("shows the built-in draft with the banner and the open terms when nothing is stored", () => {
    const r = resolvePolicy("cancellations-and-refunds", undefined, staging)!;
    expect(r).toMatchObject({ view: "draft", banner: true, title: "Cancellations and refunds", lastReviewed: null });
    expect(r.paragraphs.join("\n\n")).toBe(getPolicyDefinition("cancellations-and-refunds")!.draft(contact));
    expect(r.openTerms.length).toBeGreaterThan(0);
    expect(DRAFT_BANNER_TITLE).toBe("Draft — awaiting Lody’s approval");
  });

  it("falls back to the draft when the stored body is blank, even if ticked approved", () => {
    expect(resolvePolicy("privacy", { privacy: { body: "   ", approved: true } }, staging)!.view).toBe("draft");
  });

  it("shows saved, unapproved text with the banner instead of the draft", () => {
    const stored: StoredPolicies = { privacy: { title: "Our privacy promise", body: "Saved text.\n\nMore.", approved: false } };
    const r = resolvePolicy("privacy", stored, staging)!;
    expect(r).toMatchObject({ view: "saved", banner: true, title: "Our privacy promise", openTerms: [], lastReviewed: null });
    expect(r.paragraphs).toEqual(["Saved text.", "More."]);
  });

  it("shows approved text without a banner", () => {
    expect(resolvePolicy("pickup-and-delivery", approvedPickup, staging)).toMatchObject({ view: "approved", banner: false, title: "Collecting your order" });
  });

  it("passes the shop's contact details into the draft", () => {
    const other = { ...contact, street: "1 Example St.", locality: "Elsewhere, MA 01234" };
    const r = resolvePolicy("pickup-and-delivery", undefined, { staging: true, contact: other })!;
    expect(r.paragraphs[0]).toContain("1 Example St., Elsewhere, MA 01234");
  });
});

describe("unknown slugs and helpers", () => {
  it("returns null for an unknown slug in every environment", () => {
    for (const env of [live, staging]) {
      for (const slug of ["nope", "", "Privacy", "__proto__", "privacy-policy"]) expect(resolvePolicy(slug, approvedPickup, env)).toBeNull();
    }
  });

  it("resolves every policy in order", () => {
    expect(resolveAllPolicies(approvedPickup, live).map((p) => [p.slug, p.view])).toEqual([
      ["pickup-and-delivery", "approved"],
      ["cancellations-and-refunds", "pending"],
      ["substitutions-and-dietary-requests", "pending"],
      ["damaged-or-missing-items", "pending"],
      ["privacy", "pending"],
    ]);
    expect(resolveAllPolicies(null, staging).every((p) => p.view === "draft")).toBe(true);
  });

  it("splits paragraphs on blank lines like the About page", () => {
    expect(toParagraphs("One\ntwo\n\nThree\n  \n\nFour")).toEqual(["One\ntwo", "Three", "Four"]);
    expect(toParagraphs("  \n ")).toEqual([]);
  });

  it("formats the review date as a date only", () => {
    expect(formatReviewed("2026-10-06T12:00:00.000Z")).toBe("October 6, 2026");
    expect(formatReviewed("2026-10-06T00:00:00.000Z")).toBe("October 6, 2026");
    expect(formatReviewed(null)).toBeNull();
    expect(formatReviewed("not a date")).toBeNull();
  });

  it("labels each status for staging", () => {
    expect(policyStatusLabel("approved")).toBe("Approved");
    expect(policyStatusLabel("draft")).toContain(DRAFT_BANNER_TITLE);
    expect(policyStatusLabel("saved")).toContain("not approved");
  });
});

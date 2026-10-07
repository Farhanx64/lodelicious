/**
 * Policy pages (D39): what a visitor sees on the live site versus staging, one h1 per page, and the
 * quiet policy links on checkout and reservation.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PolicyDocument } from "@/components/policies/PolicyDocument";
import { PolicyIndex } from "@/components/policies/PolicyIndex";
import { PolicyLinks } from "@/components/policies/PolicyLinks";
import { POLICIES, resolveAllPolicies, resolvePolicy, type ContactFacts, type StoredPolicies } from "@/src/lib/policies";

const contact: ContactFacts = { street: "24 Manomet Point Rd.", locality: "Plymouth, MA 02360", phone: "(774) 283-4676", email: "lodelicious1@gmail.com" };
const notice = "Our chocolates and fudge contain common allergens.\nPlease contact us before ordering.";

const stored: StoredPolicies = {
  pickupAndDelivery: { body: "Approved pickup text.\n\nSecond paragraph.", approved: true, lastReviewed: "2026-10-06T12:00:00.000Z" },
  privacy: { body: "Saved but unapproved privacy text.", approved: false },
};

const doc = (slug: string, staging: boolean, data: StoredPolicies = stored) =>
  renderToStaticMarkup(createElement(PolicyDocument, { policy: resolvePolicy(slug, data, { staging, contact })!, contact, allergyNotice: notice }));
const h1s = (html: string) => html.match(/<h1[ >]/g)?.length ?? 0;

describe("PolicyDocument on the live site", () => {
  it("shows approved text, its review date and the contact details, with one h1", () => {
    const html = doc("pickup-and-delivery", false);
    expect(h1s(html)).toBe(1);
    expect(html).toContain("Approved pickup text.");
    expect(html).toContain("Second paragraph.");
    expect(html).toContain("Last reviewed October 6, 2026");
    expect(html).not.toContain("data-policy-banner");
    expect(html).toContain('href="tel:+17742834676"');
    expect(html).toContain('href="mailto:lodelicious1@gmail.com"');
    expect(html).toContain("24 Manomet Point Rd.");
  });

  it("shows only the being-finalised message, with contact details, for unapproved text", () => {
    const html = doc("privacy", false);
    expect(h1s(html)).toBe(1);
    expect(html).toContain("This policy is being finalised. Please contact us with any questions.");
    expect(html).toContain("data-policy-pending");
    expect(html).not.toContain("Saved but unapproved privacy text.");
    expect(html).not.toContain("data-policy-banner");
    expect(html).not.toMatch(/Draft/);
    expect(html).toContain('href="tel:+17742834676"');
  });

  it("never shows draft wording or open terms for a policy with nothing saved", () => {
    for (const p of POLICIES) {
      const html = doc(p.slug, false, {});
      expect(html, p.slug).toContain("being finalised");
      expect(html, p.slug).not.toContain("Still to be decided");
      expect(html, p.slug).not.toContain("Admin → Policies");
      expect(h1s(html), p.slug).toBe(1);
    }
  });

  it("shows the store's allergy notice under the dietary policy, even while it is being finalised", () => {
    const html = doc("substitutions-and-dietary-requests", false, {});
    expect(html).toContain("Allergy notice");
    expect(html).toContain("Our chocolates and fudge contain common allergens.");
    expect(doc("privacy", false, {})).not.toContain("Allergy notice");
  });
});

describe("PolicyDocument on staging", () => {
  it("shows the draft banner and the open terms over the built-in wording", () => {
    const html = doc("cancellations-and-refunds", true, {});
    expect(h1s(html)).toBe(1);
    expect(html).toContain("data-policy-banner");
    expect(html).toContain("Draft — awaiting Lody’s approval");
    expect(html).toContain("Still to be decided");
    expect(html).toContain("Whether the custom-basket deposit can be refunded");
    expect(html).toContain("Whether the deposit can be refunded is being finalised.");
  });

  it("shows saved, unapproved text with the banner", () => {
    const html = doc("privacy", true);
    expect(html).toContain("Draft — awaiting Lody’s approval");
    expect(html).toContain("Saved but unapproved privacy text.");
    expect(html).not.toContain("Still to be decided");
  });

  it("shows approved text without a banner", () => {
    const html = doc("pickup-and-delivery", true);
    expect(html).toContain("Approved pickup text.");
    expect(html).not.toContain("data-policy-banner");
  });
});

describe("PolicyIndex", () => {
  const index = (staging: boolean) =>
    renderToStaticMarkup(createElement(PolicyIndex, { policies: resolveAllPolicies(stored, { staging, contact }), staging, contact }));

  it("lists every policy with a link, with one h1", () => {
    for (const staging of [true, false]) {
      const html = index(staging);
      expect(h1s(html)).toBe(1);
      for (const p of POLICIES) expect(html, p.slug).toContain(`href="/policies/${p.slug}"`);
    }
  });

  it("shows each policy's status on staging only", () => {
    const html = index(true);
    expect(html.match(/data-policy-status/g)).toHaveLength(POLICIES.length);
    expect(html).toContain("Approved");
    expect(html).toContain("text saved, not approved");
    expect(html).toContain("built-in wording");
    expect(index(false)).not.toContain("data-policy-status");
    expect(index(false)).not.toContain("Draft");
  });
});

describe("PolicyLinks", () => {
  it("links the pickup and cancellation policies without asking the customer to agree", () => {
    for (const action of ["order", "reserve"] as const) {
      const html = renderToStaticMarkup(createElement(PolicyLinks, { action }));
      expect(html).toContain('href="/policies/pickup-and-delivery"');
      expect(html).toContain('href="/policies/cancellations-and-refunds"');
      expect(html).toContain(`Before you ${action}`);
      expect(html).not.toMatch(/agree|accept|checkbox/i);
    }
  });
});

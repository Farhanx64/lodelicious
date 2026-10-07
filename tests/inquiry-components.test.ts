/**
 * Render checks for the inquiry UI (D37): the estimate, the offer, the store details and both
 * forms. The pages themselves read Payload, so they are covered by the integration tests and the
 * browser checks; these components take plain props.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EstimateSummary } from "@/components/inquiries/EstimateSummary";
import { FountainOffer } from "@/components/inquiries/FountainOffer";
import { InquiryForm } from "@/components/inquiries/InquiryForm";
import { StoreDetails } from "@/components/inquiries/StoreDetails";
import type { StoreSetting } from "@/payload-types";
import { DEFAULT_FOUNTAIN_TERMS } from "@/src/lib/inquiries/estimate";
import { eventOfferFrom } from "@/src/lib/inquiries/offer";
import { CONTACT_TOPICS, HONEYPOT_FIELD, TOPIC_LABELS } from "@/src/lib/inquiries/shared";

const noop = async () => ({ error: null });
// Visible text only: no scripts or tags, entities decoded, whitespace collapsed.
const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<!-- -->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

describe("EstimateSummary", () => {
  const render = (guests: string) => renderToStaticMarkup(createElement(EstimateSummary, { terms: DEFAULT_FOUNTAIN_TERMS, guests }));

  it("shows $250 + $8.50 x guests, labelled an estimate that staff confirm", () => {
    const html = text(render("50"));
    expect(html).toContain("$250.00");
    expect(html).toContain("50 guests × $8.50");
    expect(html).toContain("$425.00");
    expect(html).toContain("Estimated total, before tax");
    expect(html).toContain("$675.00");
    expect(html).toMatch(/estimate only/i);
    expect(html).toMatch(/staff confirm/i);
  });

  it("keeps tax and other charges separate, and asks for the deposit only after confirmation", () => {
    const html = text(render("50"));
    expect(html).toMatch(/Sales tax and any other approved charges are separate/);
    expect(html).toMatch(/25% deposit is requested only after we confirm your booking/);
    expect(html).toMatch(/Sending this request charges nothing/);
  });

  it("announces changes politely", () => {
    const html = render("50");
    expect(html).toContain('aria-live="polite"');
    // The disclaimer sits outside the live region, so it isn't re-read on every keystroke.
    expect(html.slice(html.indexOf("</dl>"))).toContain("estimate only");
    expect(html.slice(html.indexOf('aria-live="polite"'), html.indexOf("</dl>"))).not.toContain("estimate only");
  });

  it("says 1 guest, and asks for a count instead of a made-up price when it is not valid", () => {
    expect(text(render("1"))).toContain("1 guest × $8.50");
    for (const bad of ["", "0", "1001", "2.5", "abc"]) {
      const html = text(render(bad));
      expect(html).toContain("Enter the number of guests (1–1000)");
      expect(html).not.toContain("Estimated total");
    }
  });
});

describe("FountainOffer", () => {
  it("states the confirmed offer from the settings", () => {
    const html = text(renderToStaticMarkup(createElement(FountainOffer, { offer: eventOfferFrom({}) })));
    expect(html).toContain("$250.00 for 2 hours, including setup and service");
    expect(html).toContain("$8.50 per person ($5.00 chocolate + $3.50 fruit)");
    expect(html).toContain("A 25% deposit is requested once we’ve confirmed your booking");
    expect(html).toContain("not when you send the request");
    expect(html).toContain("Sending a request books nothing and charges nothing");
  });

  it("shows unresolved terms only once they have been filled in", () => {
    const blank = renderToStaticMarkup(createElement(FountainOffer, { offer: eventOfferFrom({}) }));
    expect(blank).not.toContain("data-fountain-terms");
    for (const word of ["Cancellation", "Minimum guests", "Where we travel", "Extra time"]) expect(blank).not.toContain(word);

    const filled = renderToStaticMarkup(
      createElement(FountainOffer, {
        offer: eventOfferFrom({ baseCents: 25000, cancellationTerms: "Tell us a week ahead.", minimumGuests: 20, serviceArea: "Plymouth County", extensionTerms: "Ask about extra hours." } as never),
      }),
    );
    for (const word of ["Cancellation", "Tell us a week ahead.", "Minimum guests", ">20<", "Plymouth County", "Ask about extra hours."]) expect(filled).toContain(word);
  });

  it("follows edited prices", () => {
    const offer = eventOfferFrom({ baseCents: 30000, includedHours: 3, perGuestCents: 900, chocolatePerGuestCents: 600, fruitPerGuestCents: 300, depositPercentBasisPoints: 3000 } as never);
    const html = text(renderToStaticMarkup(createElement(FountainOffer, { offer })));
    expect(html).toContain("$300.00 for 3 hours");
    expect(html).toContain("$9.00 per person ($6.00 chocolate + $3.00 fruit)");
    expect(html).toContain("A 30% deposit");
  });
});

describe("StoreDetails", () => {
  const store = {
    name: "Souset-Pink",
    street: "24 Manomet Point Rd.",
    locality: "Plymouth, MA 02360",
    phone: "(774) 283-4676",
    email: "lodelicious1@gmail.com",
    hoursLabel: "Fall & winter hours",
    hours: [{ id: "a", days: "Mon–Thu", time: "11 AM – 6 PM" }],
    closedDays: [{ id: "c", label: "Christmas Day" }],
  } as unknown as StoreSetting;
  const render = (patch: Partial<StoreSetting> = {}) => renderToStaticMarkup(createElement(StoreDetails, { store: { ...store, ...patch } }));

  it("shows the address, a tap-to-call phone, the email, the hours and closed days", () => {
    const html = render();
    expect(html).toContain("24 Manomet Point Rd.");
    expect(html).toContain('href="tel:+17742834676"');
    expect(html).toContain('href="mailto:lodelicious1@gmail.com"');
    expect(text(html)).toContain("Mon–Thu 11 AM – 6 PM");
    expect(html).toContain("Closed Christmas Day.");
  });

  it("links DoorDash only when the link is set", () => {
    expect(render()).not.toContain("doordash");
    expect(render({ doordashUrl: "https://www.doordash.com/store/example" })).toContain('href="https://www.doordash.com/store/example"');
  });
});

describe("InquiryForm (contact)", () => {
  const topics = CONTACT_TOPICS.map((value) => ({ value, label: TOPIC_LABELS[value] }));
  const render = (patch: { defaultTopic?: string; item?: { slug: string; title: string } | null } = {}) =>
    renderToStaticMarkup(createElement(InquiryForm, { kind: "contact", action: noop, topics, defaultTopic: patch.defaultTopic ?? "general", item: patch.item ?? null }));

  it("offers every topic except the fountain, and preselects the one asked for", () => {
    const html = render({ defaultTopic: "baby_white" });
    for (const topic of CONTACT_TOPICS) expect(html).toContain(`value="${topic}"`);
    expect(html).not.toContain('value="fountain"');
    expect(html).toMatch(/<option value="baby_white" selected="">/);
  });

  it("names the product being asked about, escaped, and sends only its slug", () => {
    const html = render({ item: { slug: "sweet-basket", title: "Sweet <b>Basket</b> & more" } });
    expect(text(html)).toContain("Asking about: Sweet <b>Basket</b> & more");
    expect(html).toContain("Sweet &lt;b&gt;Basket&lt;/b&gt; &amp; more");
    expect(html).toContain('<input type="hidden" name="item" value="sweet-basket"/>');
    expect(render()).not.toContain("Asking about");
  });

  it("labels every field and limits their length", () => {
    const html = render();
    const ids = [...html.matchAll(/<(?:input|select|textarea)[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(expect.arrayContaining(["contact-topic", "contact-message", "contact-name", "contact-email", "contact-phone"]));
    for (const id of ids) expect(html).toContain(`for="${id}"`);
    expect(html).toContain('maxLength="2000"');
    expect(html).toContain('type="email"');
    expect(html).toContain('autoComplete="email"');
  });

  it("carries a honeypot that people can't see or tab to", () => {
    const wrapper = /<div aria-hidden="true"[^>]*>([\s\S]*?)<\/div>/.exec(render())?.[1] ?? "";
    expect(wrapper).toContain(`name="${HONEYPOT_FIELD}"`);
    expect(wrapper).toContain('tabindex="-1"');
    expect(wrapper).toContain('autoComplete="off"');
  });

  it("promises nothing is ordered or charged, and asks for no payment details", () => {
    const html = text(render());
    expect(html).toMatch(/reply by email or phone/);
    expect(html).toMatch(/don't send card numbers/i);
  });
});

describe("InquiryForm (fountain)", () => {
  const html = renderToStaticMarkup(createElement(InquiryForm, { kind: "fountain", action: noop, terms: DEFAULT_FOUNTAIN_TERMS, minDate: "2026-10-05" }));

  it("collects date, setup time, location, guests and contact details", () => {
    for (const name of ["eventDate", "setupTime", "location", "guests", "name", "email", "phone"]) expect(html).toContain(`name="${name}"`);
    expect(html).toContain('type="date"');
    expect(html).toContain('min="2026-10-05"');
    expect(html).toContain('type="time"');
    expect(html).toMatch(/name="guests"[^>]*>|type="number"/);
    expect(html).toContain('min="1"');
    expect(html).toContain('max="1000"');
  });

  it("includes the live estimate, and never an estimate field the browser could tamper with", () => {
    expect(html).toContain("data-estimate");
    expect(html).not.toMatch(/name="(estimate|total|price|amount)/i);
  });

  it("is inquiry-only: no payment fields, and it says nothing is booked or charged", () => {
    expect(html).not.toMatch(/card|cvv|expir|payment/i);
    expect(text(html)).toMatch(/does not book or charge anything/);
  });

  it("labels every field and has a honeypot", () => {
    const ids = [...html.matchAll(/<(?:input|select|textarea)[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThanOrEqual(8);
    for (const id of ids) expect(html).toContain(`for="${id}"`);
    expect(html).toContain(`name="${HONEYPOT_FIELD}"`);
  });
});

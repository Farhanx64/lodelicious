/**
 * The footer's "Our story" column (D30) appears only when Lody has written it, and the DoorDash
 * link only when it is set (D28).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/layout/SiteFooter";
import type { StoreSetting } from "@/payload-types";

const store = {
  id: 1,
  name: "Lodelicious Gifts & Sweets",
  street: "24 Manomet Point Rd.",
  locality: "Plymouth, MA 02360",
  phone: "(774) 283-4676",
  email: "lodelicious1@gmail.com",
  timezone: "America/New_York",
  hoursLabel: "Fall & winter hours",
  hours: [],
  closedDays: [],
  allergyNotice: "",
  storyHeading: "Our story",
} as unknown as StoreSetting;

const render = (patch: Partial<StoreSetting> = {}) => renderToStaticMarkup(createElement(SiteFooter, { store: { ...store, ...patch } }));

describe("SiteFooter", () => {
  it("hides the story until it is written", () => {
    expect(render()).not.toContain("footer-story");
    expect(render({ story: "   " })).not.toContain("footer-story");
  });

  it("shows the story under its heading, one paragraph per blank-line block", () => {
    const html = render({ story: "First paragraph.\n\nSecond paragraph.", storyHeading: "How we started" });
    expect(html).toContain("How we started");
    expect(html.match(/<p class="mb-2 whitespace-pre-line">/g)).toHaveLength(2);
  });

  it("links DoorDash only when the link is set", () => {
    expect(render()).not.toContain("doordash.com");
    expect(render({ doordashUrl: "https://www.doordash.com/store/example" })).toContain('href="https://www.doordash.com/store/example"');
  });
});

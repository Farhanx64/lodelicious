import { describe, expect, it } from "vitest";

import { CONTACT_TOPICS, INQUIRY_TOPICS, contactHref, formatInquiryNumber, isContactTopic, isInquiryTopic, topicForPresentation, topicForProduct } from "./shared";

describe("topics (the contract shared with the other pages)", () => {
  it("are exactly the agreed list", () => {
    expect([...INQUIRY_TOPICS]).toEqual(["general", "gift_basket", "gift_box", "baby_white", "cowboy", "filled_ceramic", "custom_request", "fountain"]);
  });

  it("keeps the fountain off the general form", () => {
    expect(CONTACT_TOPICS).not.toContain("fountain");
    expect(isInquiryTopic("fountain")).toBe(true);
    expect(isContactTopic("fountain")).toBe(false);
    expect(isContactTopic("gift_box")).toBe(true);
    for (const bad of ["", "GENERAL", "toString", "__proto__", null, undefined, 3]) expect(isInquiryTopic(bad)).toBe(false);
  });
});

describe("links into /contact", () => {
  it("sends gift-basket products to the basket topic and everything else to general", () => {
    expect(topicForProduct("gift-baskets")).toBe("gift_basket");
    expect(topicForProduct("fudge")).toBe("general");
    expect(topicForProduct(null)).toBe("general");
  });

  it("maps special presentations to topics; the three ceramics share one", () => {
    expect(topicForPresentation("cowboy")).toBe("cowboy");
    expect(topicForPresentation("baby_white")).toBe("baby_white");
    for (const code of ["ceramic_bowl", "ceramic_shoes", "ceramic_block"]) expect(topicForPresentation(code)).toBe("filled_ceramic");
    expect(topicForPresentation("nope")).toBeNull();
  });

  it("builds the href with topic and item", () => {
    expect(contactHref()).toBe("/contact");
    expect(contactHref({ topic: "baby_white" })).toBe("/contact?topic=baby_white");
    expect(contactHref({ topic: "gift_basket", item: "sweet-basket" })).toBe("/contact?topic=gift_basket&item=sweet-basket");
  });
});

describe("inquiry numbers", () => {
  it("start at INQ-1001", () => {
    expect(formatInquiryNumber(1)).toBe("INQ-1001");
    expect(formatInquiryNumber(12)).toBe("INQ-1012");
  });
});

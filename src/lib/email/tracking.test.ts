import { describe, expect, it } from "vitest";

import { cleanTrackingNumber, trackingUrl } from "./tracking";

describe("trackingUrl (D64)", () => {
  it("links each carrier's public tracking page", () => {
    expect(trackingUrl("usps", "9400 1000 0000 0000 0000 00")).toBe("https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000000000000");
    expect(trackingUrl("ups", "1z12345e0205271688")).toBe("https://www.ups.com/track?tracknum=1Z12345E0205271688");
    expect(trackingUrl("fedex", "1234-5678-9012")).toBe("https://www.fedex.com/fedextrack/?trknbr=123456789012");
  });

  it("has no link for another carrier, a missing number or an unknown carrier", () => {
    expect(trackingUrl("other", "ABC123")).toBeNull();
    expect(trackingUrl("usps", "")).toBeNull();
    expect(trackingUrl("usps", null)).toBeNull();
    expect(trackingUrl("dhl", "ABC123")).toBeNull();
    expect(trackingUrl(null, "ABC123")).toBeNull();
  });

  it("keeps only letters and digits, so nothing typed can change the URL", () => {
    expect(cleanTrackingNumber(`1Z"><script>&x=1`)).toBe("1ZSCRIPTX1");
    expect(trackingUrl("ups", "1Z?a=b#c")).toBe("https://www.ups.com/track?tracknum=1ZABC");
    expect(cleanTrackingNumber("x".repeat(80))).toHaveLength(40);
  });
});

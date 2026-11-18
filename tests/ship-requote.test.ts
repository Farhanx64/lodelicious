/** Shipping is priced again whenever the bag or basket changes on the page (D67). */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("live shipping follows the contents", () => {
  it("the quote effect depends on the contents key, and both pages pass one built from items and quantities", () => {
    expect(readFileSync("components/checkout/ShippingFields.tsx", "utf8")).toContain("[liveQuote, setQuote, zip, state, contentsKey]");
    expect(readFileSync("app/(frontend)/checkout/page.tsx", "utf8")).toMatch(/contentsKey=\{bag\.payable\.map\(\(l\) => `\$\{l\.unitId\}:\$\{l\.quantity\}`\)/);
    expect(readFileSync("app/(frontend)/reserve/page.tsx", "utf8")).toMatch(/contentsKey=\{basket\.components\.map/);
  });
});

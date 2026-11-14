/**
 * The checkout's totals follow the ship-to state without a page load (D65). Rendered to static
 * markup: the provider's starting state picks which server-rendered version shows, and the
 * address select says the total depends on the state.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ExpectedCharge, ForShipTax, ShipTaxProvider, ShipTaxText, ShipToState } from "@/components/checkout/ShipTax";
import { ShippingAddressFields } from "@/components/checkout/ShippingFields";
import { RewardChoice } from "@/components/rewards/RewardChoice";

const html = (initialState: string | null, child: React.ReactNode) =>
  renderToStaticMarkup(initialState === null ? createElement("div", null, child) : createElement(ShipTaxProvider, { listed: ["MA"], initialState }, child));

const versions = createElement(
  "div",
  null,
  createElement(ForShipTax, { variant: "MA" }, "Tax (MA 6.25%) $1.25"),
  createElement(ForShipTax, { variant: "none" }, createElement("span", null, "No sales tax (ships to ", createElement(ShipToState), ")")),
  createElement(ForShipTax, { variant: "pickup" }, "Tax $1.25"),
  createElement(ShipTaxText, { texts: { MA: "Pay $30.20", none: "Pay $28.95", pickup: "Pay $21.25" } }),
);

describe("ship-to tax versions", () => {
  it("MA shows the MA version", () => {
    const out = html("MA", versions);
    expect(out).toContain("Tax (MA 6.25%) $1.25");
    expect(out).toContain("Pay $30.20");
    expect(out).not.toContain("No sales tax");
  });

  it("any other state shows no sales tax, naming the state", () => {
    const out = html("NY", versions);
    expect(out).toContain("No sales tax (ships to NY)");
    expect(out).toContain("Pay $28.95");
    expect(out).not.toContain("MA 6.25%");
  });

  it("pickup (no provider) shows the one version it always had", () => {
    const out = html(null, versions);
    expect(out).toContain("Tax $1.25");
    expect(out).toContain("Pay $21.25");
  });

  it("the state select is described as changing the total; reward labels follow the state", () => {
    const fields = html("MA", createElement(ShippingAddressFields, { prefix: "checkout" }));
    expect(fields).toContain('aria-describedby="checkout-shipState-tax"');
    expect(fields).toMatch(/Sales tax depends on the state/);
    const options = [{ id: "r5", label: "$5.00 off (total $15.94)", labels: { MA: "$5.00 off (total $15.94)", none: "$5.00 off (total $15.00)" } }];
    expect(html("NY", createElement(RewardChoice, { options, balanceLabel: "300 points", earnLabel: null }))).toContain("$5.00 off (total $15.00)");
    expect(html("MA", createElement(RewardChoice, { options, balanceLabel: "300 points", earnLabel: null }))).toContain("$5.00 off (total $15.94)");
  });

  it("sends no expected total from the server render (only once the page can follow the state)", () => {
    expect(html("MA", createElement(ExpectedCharge, { amounts: { MA: { cents: 3020 } } }))).not.toContain("expectedCents");
  });
});

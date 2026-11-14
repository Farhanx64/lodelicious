/**
 * The checkout and reserve layout (D56): the pickup/ship switch, the grouped address box, the order
 * summary's stepper, remove button and totals, the reward radios joining the form from outside it,
 * and the Pay button's sticky phone footer. Rendered to static markup.
 */
import { createElement, type ComponentProps, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(frontend)/cart/actions", () => ({ addToBag: vi.fn(), updateBagLine: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; scroll?: boolean }) => {
    delete rest.scroll;
    return createElement("a", { href, ...rest }, children);
  },
}));

import { ActionForm, FormValuesContext } from "@/components/checkout/ActionForm";
import { CheckoutTopBar, ItemCard, PayTotals, TotalsCard } from "@/components/checkout/CheckoutLayout";
import { FulfillmentChoice } from "@/components/checkout/FulfillmentChoice";
import { AddOnButton, QtyStepper, RemoveLine, SummaryDisclosure } from "@/components/checkout/OrderSummaryParts";
import { ShippingAddressFields } from "@/components/checkout/ShippingFields";
import { RewardChoice } from "@/components/rewards/RewardChoice";
import { describeTax, formatRate } from "@/src/lib/checkout/tax";

const render = (el: React.ReactElement) => renderToStaticMarkup(el);
const within = (values: Record<string, string>, child: React.ReactElement) => render(createElement(FormValuesContext, { value: values }, child));
/** The opening tag of the element carrying `marker`, so attribute order doesn't matter. */
const tagWith = (html: string, marker: string) => html.match(new RegExp(`<[a-z]+[^>]*${marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^>]*>`))?.[0] ?? "";
const SummaryDisclosureWithChildren = SummaryDisclosure as unknown as ComponentType<Omit<ComponentProps<typeof SummaryDisclosure>, "children">>;
const ActionFormWithChildren = ActionForm as unknown as ComponentType<Omit<ComponentProps<typeof ActionForm>, "children">>;

describe("fulfilment switch", () => {
  const ships = { available: true, cents: 895, packing: { box: null, reason: "no_boxes" }, chargedBy: "rules" } as const;

  it("marks the current half, posts the method, and links each half to its own server-priced page", () => {
    const pickup = render(createElement(FulfillmentChoice, { path: "/checkout", method: "pickup", shipping: ships }));
    expect(pickup).toMatch(/<a href="\/checkout" aria-current="true"[^>]*>.*Pickup/);
    expect(pickup).toMatch(/<a href="\/checkout\?method=ship"[^>]*>.*Ship.*\$8\.95/);
    expect(pickup).toContain('<input type="hidden" name="method" value="pickup"/>');
    expect(pickup).toContain('role="group" aria-labelledby="fulfillment-heading"');

    const ship = render(createElement(FulfillmentChoice, { path: "/reserve", method: "ship", shipping: ships }));
    expect(ship).toMatch(/<a href="\/reserve\?method=ship" aria-current="true"/);
    expect(ship).toContain('value="ship"');
  });

  it("shows shipping greyed out, not as a link, with the reason when the order can't ship", () => {
    const html = render(
      createElement(FulfillmentChoice, { path: "/checkout", method: "pickup", shipping: { available: false, reason: "not_shippable", blockers: ["Baklava"] } }),
    );
    expect(html).not.toContain("method=ship");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("Pickup only: Baklava can&#x27;t be shipped.");
  });
});

describe("shipping address box", () => {
  it("labels every part, fixes the country to the US, and keeps entries after an error", () => {
    const html = within({ shipLine1: "1 Main St", shipCity: "Boston", shipState: "NY", shipZip: "02110" }, createElement(ShippingAddressFields, { prefix: "checkout" }));
    for (const name of ["shipName", "shipLine1", "shipLine2", "shipState", "shipCity", "shipZip"]) expect(html).toContain(`for="checkout-${name}"`);
    expect(html).toContain("United States");
    expect(html).toContain('value="1 Main St"');
    expect(html).toMatch(/<option value="NY" selected/);
    expect(tagWith(html, 'name="shipZip"')).toContain('required=""');
  });
});

describe("order summary", () => {
  it("the stepper can't go below 1 or above 20, and names the product on each button", () => {
    const one = render(createElement(QtyStepper, { unitId: "7", title: "Fudge", quantity: 1 }));
    expect(tagWith(one, 'aria-label="One fewer Fudge"')).toMatch(/value="0".*disabled=""/);
    expect(tagWith(one, 'aria-label="One more Fudge"')).toContain('value="2"');
    expect(tagWith(one, 'aria-label="One more Fudge"')).not.toContain('disabled=""');
    expect(one).toContain('aria-live="polite"');
    expect(one).toContain('name="unitId" value="7"');
    expect(tagWith(render(createElement(QtyStepper, { unitId: "7", title: "Fudge", quantity: 20 })), 'aria-label="One more Fudge"')).toContain('disabled=""');
  });

  it("the X removes that line", () => {
    const html = render(createElement(RemoveLine, { unitId: "7:pink", title: "Fudge" }));
    expect(tagWith(html, 'aria-label="Remove Fudge"')).toMatch(/value="1".*name="remove"/);
    expect(html).toContain('value="7:pink"');
  });

  it("an item card shows the quantity as text when it can't be changed (a reserved basket)", () => {
    const html = render(createElement("ul", null, createElement(ItemCard, { title: "Basket & packaging", quantity: 1, totalCents: 1995 })));
    expect(html).toContain("Qty 1");
    expect(html).toContain("$19.95");
  });

  it("totals: pickup is free, shipping is its charge, and tax has an info button", () => {
    const base = { subtotalCents: 1000, taxCents: 63, totalCents: 1063, taxApproved: true, taxNote: "Sales tax 6.25% on taxable items." };
    const pickup = render(createElement(TotalsCard, { ...base, shipping: { method: "pickup", cents: 0 } }));
    expect(pickup).toMatch(/Pickup in store<\/dt><dd[^>]*>Free/);
    expect(pickup).toContain('aria-label="About tax"');
    const ship = render(createElement(TotalsCard, { ...base, totalCents: 1958, shipping: { method: "ship", cents: 895 } }));
    expect(ship).toMatch(/Shipping<\/dt><dd[^>]*>\$8\.95/);
    expect(ship).toContain("$19.58");
    expect(render(createElement(TotalsCard, { ...base, taxApproved: false, shipping: { method: "pickup", cents: 0 } }))).toContain("Estimated tax (to be confirmed)");
  });

  it("repeats subtotal and total above the button", () => {
    const html = render(createElement(PayTotals, { subtotalCents: 1000, totalCents: 1063, rows: [{ label: "Includes tax", value: "$0.63" }] }));
    expect(html).toContain("$10.00");
    expect(html).toContain("$10.63");
    expect(html).toContain("Includes tax");
  });

  it("on a phone the summary starts folded behind a button that says the total", () => {
    const html = render(createElement(SummaryDisclosureWithChildren, { id: "order-summary", totalLabel: "$10.63" }, createElement("p", null, "lines")));
    expect(html).toContain('aria-expanded="false" aria-controls="order-summary"');
    expect(html).toContain("Show order summary");
    expect(html).toContain('id="order-summary" class="hidden md:block"');
  });

  it("the close link and breadcrumb go back to the bag", () => {
    const html = render(createElement(CheckoutTopBar, { back: { href: "/cart", label: "Bag" }, current: "Checkout" }));
    expect(html).toContain('aria-label="Close checkout, back to bag"');
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('aria-current="page"');
  });

  it("the add-on comes back to checkout and names the product on its button", () => {
    const html = render(createElement(AddOnButton, { unitId: "12", title: "Dark bar", next: "/checkout?method=ship" }));
    expect(html).toContain('name="next" value="/checkout?method=ship"');
    expect(html).toContain('aria-label="Add to your order: Dark bar"');
  });
});

describe("reward choice outside the form", () => {
  it("each radio joins the checkout form by id, and the choice survives an error", () => {
    const html = within(
      { reward: "r5" },
      createElement(RewardChoice, { formId: "checkout-form", options: [{ id: "r5", label: "$5 off" }], balanceLabel: "600 points", earnLabel: null }),
    );
    expect(html.match(/form="checkout-form"/g)).toHaveLength(2);
    expect(tagWith(html, 'value="r5"')).toContain('checked=""');
    expect(tagWith(html, 'value="none"')).not.toContain("checked");
  });
});

describe("ActionForm with the order summary beside it", () => {
  it("puts the summary outside the form, gives the form its id, and makes the Pay button sticky on a phone", () => {
    const html = render(
      createElement(
        ActionFormWithChildren,
        {
          id: "checkout-form",
          action: async () => ({ error: null }),
          submitLabel: "Pay $10.63",
          pendingLabel: "Placing order…",
          aside: createElement("aside", null, createElement("form", { "data-qty": "" })),
          wrapperClassName: "grid",
          stickySubmit: true,
          afterSubmit: createElement("p", null, "policies"),
        },
        createElement("p", null, "fields"),
      ),
    );
    expect(html).toMatch(/^<div class="grid"><aside><form data-qty=""><\/form><\/aside><form id="checkout-form"/);
    expect(html).toMatch(/<div data-sticky-submit[^>]*sticky bottom-0[^>]*md:static[^>]*><button type="submit"/);
    expect(html.indexOf("Pay $10.63")).toBeLessThan(html.indexOf("policies"));
  });
});

describe("tax note", () => {
  const ma = { id: "1", name: "Sales tax 6.25%", rateBasisPoints: 625, approved: true };
  it("formats basis points", () => {
    expect(formatRate(625)).toBe("6.25%");
    expect(formatRate(700)).toBe("7%");
    expect(formatRate(650)).toBe("6.5%");
  });
  it("names the rate actually used, never a fixed figure", () => {
    expect(describeTax([ma, ma, null], true)).toBe("Sales tax 6.25% on taxable items. Shipping isn't taxed.");
    expect(describeTax([{ ...ma, name: "Sales tax" }], true)).toBe("Sales tax 6.25% on taxable items. Shipping isn't taxed.");
    expect(describeTax([null, { ...ma, rateBasisPoints: 0 }], true)).toBe("No sales tax applies to the items in this order. Shipping isn't taxed.");
    expect(describeTax([ma, { ...ma, id: "2", name: "Meals", rateBasisPoints: 700 }], true)).toContain("6.25% or 7%");
    expect(describeTax([ma], false)).toContain("estimate");
  });
});

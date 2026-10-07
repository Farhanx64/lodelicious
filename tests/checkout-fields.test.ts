/**
 * The checkout form fields feed the customer's earlier entries back as defaults (A13), and the
 * bag button says which option it adds (A18). Rendered to static markup; the action state is
 * supplied through the same context ActionForm provides.
 */
import { createElement, type ComponentProps, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(frontend)/cart/actions", () => ({ addToBag: vi.fn() }));

import { ActionForm, FormValuesContext } from "@/components/checkout/ActionForm";
import { AddToBag } from "@/components/checkout/AddToBag";
import { ContactFields } from "@/components/checkout/ContactFields";
import { NotesField, PaymentChoice } from "@/components/checkout/FormFields";
import { PickupSelect } from "@/components/checkout/PickupSelect";

const slots = [
  { date: "2026-10-08", start: "11:00", end: "12:00" },
  { date: "2026-10-08", start: "12:00", end: "13:00" },
  { date: "2026-10-09", start: "11:00", end: "12:00" },
];

const within = (values: Record<string, string>, child: React.ReactNode) => renderToStaticMarkup(createElement(FormValuesContext, { value: values }, child));

describe("fields keep earlier entries after an error", () => {
  it("contact fields start empty and come back filled", () => {
    expect(renderToStaticMarkup(createElement(ContactFields, { prefix: "checkout" }))).not.toContain("value=");
    const html = within({ name: "Ann Lee", email: "ann@example.test", phone: "508-555-0100" }, createElement(ContactFields, { prefix: "checkout" }));
    expect(html).toContain('value="Ann Lee"');
    expect(html).toContain('value="ann@example.test"');
    expect(html).toContain('value="508-555-0100"');
  });

  it("the pickup choice stays selected, and falls back to the first time if it is no longer offered", () => {
    const kept = within({ pickup: "2026-10-08|12:00" }, createElement(PickupSelect, { slots, id: "p" }));
    expect(kept).toMatch(/<option value="2026-10-08\|12:00" selected/);
    expect(kept.match(/selected/g)).toHaveLength(1);
    const gone = within({ pickup: "2026-10-01|09:00" }, createElement(PickupSelect, { slots, id: "p" }));
    expect(gone).not.toContain("selected");
  });

  it("the notes box keeps its text", () => {
    expect(within({ notes: "Please leave at the side door" }, createElement(NotesField, { id: "n" }))).toContain("Please leave at the side door");
  });

  it("the payment choice remembers pay-in-full, and only offers it when allowed", () => {
    const props = { depositLabel: "25% deposit", chargeNowText: "$25.00", balanceDueText: "$75.00", fullText: "$100.00" };
    const isChecked = (html: string, value: string) => new RegExp(`<input[^>]*checked=""[^>]*value="${value}"`).test(html);
    const full = within({ payment: "full" }, createElement(PaymentChoice, props));
    expect(isChecked(full, "full")).toBe(true);
    expect(isChecked(full, "deposit")).toBe(false);
    expect(isChecked(within({}, createElement(PaymentChoice, props)), "deposit")).toBe(true);
    const depositOnly = within({ payment: "full" }, createElement(PaymentChoice, { ...props, fullText: undefined }));
    expect(depositOnly).not.toContain('value="full"');
    expect(isChecked(depositOnly, "deposit")).toBe(true);
  });
});

// ActionForm requires `children` as a prop; createElement (and the lint rule) want them as arguments.
const ActionFormWithChildren = ActionForm as unknown as ComponentType<Omit<ComponentProps<typeof ActionForm>, "children">>;

describe("ActionForm", () => {
  it("renders the submit button enabled, with no alert, until something happens", () => {
    const html = renderToStaticMarkup(createElement(ActionFormWithChildren, { action: async () => ({ error: null }), submitLabel: "Place order", pendingLabel: "Placing order…" }, createElement("p", null, "fields")));
    expect(html).toContain("Place order");
    expect(html).not.toContain("role=\"alert\"");
    expect(html).not.toContain('aria-disabled="true"');
    expect(html).not.toMatch(/<button[^>]*\sdisabled(?=[\s=>])/);
  });

  it("keeps a native disabled button when the form cannot be submitted at all (no pickup times)", () => {
    const html = renderToStaticMarkup(createElement(ActionFormWithChildren, { action: async () => ({ error: null }), submitLabel: "Place order", pendingLabel: "…", disabled: true }));
    expect(html).toMatch(/<button[^>]*\sdisabled(?=[\s=>])/);
  });
});

describe("AddToBag accessible name (A18)", () => {
  const render = (options: { unitId: string; label: string | null; priceCents: number }[]) => renderToStaticMarkup(createElement(AddToBag, { options }));

  it("names the single option on the button, with the visible words first, and shows it", () => {
    const html = render([{ unitId: "7:pink", label: "Pink", priceCents: 1995 }]);
    expect(html).toContain('aria-label="Add to bag: Pink"');
    expect(html).toContain("Option: Pink");
    expect(html).toContain(">Add to bag</button>");
  });

  it("needs no extra name when there is no option, and uses the select when there are several", () => {
    expect(render([{ unitId: "7", label: null, priceCents: 425 }])).not.toContain("aria-label");
    const several = render([
      { unitId: "7:pink", label: "Pink", priceCents: 1995 },
      { unitId: "7:blue", label: "Blue", priceCents: 1995 },
    ]);
    expect(several).toContain("<select");
    expect(several).not.toContain("aria-label");
  });
});

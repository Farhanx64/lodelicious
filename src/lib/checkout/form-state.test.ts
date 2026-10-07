import { describe, expect, it } from "vitest";

import { echoFormValues, failedWith } from "./form-state";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("echoFormValues (A13)", () => {
  it("echoes the known fields from FormData, as strings", () => {
    expect(echoFormValues(form({ name: "Ann", email: "ann@example.test", phone: "555", pickup: "2026-10-08|11:00", notes: "Ring the bell", payment: "full" }))).toEqual({
      name: "Ann",
      email: "ann@example.test",
      phone: "555",
      pickup: "2026-10-08|11:00",
      notes: "Ring the bell",
      payment: "full",
    });
  });

  it("works on a plain object too, and never echoes unknown fields (tokens, honeypots, extras)", () => {
    expect(echoFormValues({ name: "Ann", secret: "x", $ACTION_ID_abc: "y", fax_number: "bot" })).toEqual({ name: "Ann" });
  });

  it("skips fields that were not sent and non-string values (uploaded files)", () => {
    const data = form({ name: "Ann" });
    data.set("notes", new File(["x"], "x.txt"));
    expect(echoFormValues(data)).toEqual({ name: "Ann" });
  });

  it("caps very long values", () => {
    expect(echoFormValues({ notes: "x".repeat(5000) }).notes).toHaveLength(600);
  });

  it("builds an error result that keeps the customer's entries", () => {
    expect(failedWith("That pickup time was just taken.", form({ name: "Ann", pickup: "2026-10-08|11:00" }))).toEqual({
      error: "That pickup time was just taken.",
      values: { name: "Ann", pickup: "2026-10-08|11:00" },
    });
  });
});

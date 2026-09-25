import { describe, expect, it } from "vitest";

import { diffFields } from "./audit";

describe("diffFields", () => {
  it("reports only watched fields that changed", () => {
    expect(
      diffFields({ price: 425, name: "Bar", notes: "a" }, { price: 595, name: "Bar", notes: "b" }, ["price", "name"]),
    ).toEqual([{ field: "price", before: 425, after: 595 }]);
  });

  it("treats a create as a change from nothing", () => {
    expect(diffFields(undefined, { disposition: "unreviewed" }, ["disposition"])).toEqual([
      { field: "disposition", before: null, after: "unreviewed" },
    ]);
  });

  it("ignores object key order but not array order", () => {
    expect(diffFields({ h: { a: 1, b: 2 } }, { h: { b: 2, a: 1 } }, ["h"])).toEqual([]);
    expect(diffFields({ r: ["owner", "manager"] }, { r: ["manager", "owner"] }, ["r"])).toHaveLength(1);
  });

  it("treats undefined and null as equal", () => {
    expect(diffFields({ note: null }, { note: undefined }, ["note"])).toEqual([]);
  });
});

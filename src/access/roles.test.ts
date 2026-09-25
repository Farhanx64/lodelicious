import { describe, expect, it } from "vitest";

import { canManageCommerce, hasRole } from "./roles";

describe("roles", () => {
  it("limits price changes and refunds to owner and manager (PRD OPS 01)", () => {
    expect(canManageCommerce({ roles: ["owner"] })).toBe(true);
    expect(canManageCommerce({ roles: ["manager"] })).toBe(true);
    expect(canManageCommerce({ roles: ["fulfillment"] })).toBe(false);
    expect(canManageCommerce(null)).toBe(false);
    expect(canManageCommerce({ roles: null })).toBe(false);
  });

  it("matches any of several roles", () => {
    expect(hasRole({ roles: ["fulfillment", "manager"] }, "manager")).toBe(true);
    expect(hasRole({ roles: [] }, "owner", "manager")).toBe(false);
  });
});

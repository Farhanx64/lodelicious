import { describe, expect, it } from "vitest";

import { isImagePublishable } from "./media";

describe("isImagePublishable", () => {
  it("shows only approved photos in production", () => {
    expect(isImagePublishable({ approvedForLaunch: true }, "production")).toBe(true);
    expect(isImagePublishable({ approvedForLaunch: false }, "production")).toBe(false);
    expect(isImagePublishable({ approvedForLaunch: null }, "production")).toBe(false);
  });

  it("shows every photo in staging for review", () => {
    expect(isImagePublishable({ approvedForLaunch: false }, "staging")).toBe(true);
    expect(isImagePublishable({ approvedForLaunch: false }, undefined)).toBe(true);
  });

  it("never shows a missing photo", () => {
    expect(isImagePublishable(null, "staging")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { isImagePublishable } from "./media";

describe("isImagePublishable", () => {
  const production = { APP_ENV: "production" };

  it("shows only approved photos in production", () => {
    expect(isImagePublishable({ approvedForLaunch: true }, production)).toBe(true);
    expect(isImagePublishable({ approvedForLaunch: false }, production)).toBe(false);
    expect(isImagePublishable({ approvedForLaunch: null }, production)).toBe(false);
  });

  it("shows every photo for review only when APP_ENV is explicitly local, staging or test", () => {
    for (const APP_ENV of ["staging", "local", "test"]) {
      expect(isImagePublishable({ approvedForLaunch: false }, { APP_ENV })).toBe(true);
    }
  });

  it("treats an unset or mistyped APP_ENV as production, so unapproved photos stay hidden (A09)", () => {
    for (const env of [{}, { APP_ENV: "" }, { APP_ENV: "prod" }, { APP_ENV: "stagin" }]) {
      expect(isImagePublishable({ approvedForLaunch: false }, env)).toBe(false);
      expect(isImagePublishable({ approvedForLaunch: true }, env)).toBe(true);
    }
  });

  it("never shows a missing photo", () => {
    expect(isImagePublishable(null, { APP_ENV: "staging" })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { appEnvKind, isPreviewEnv, isProductionEnv } from "./app-env";
import { previewStockEnabled } from "./catalog/preview";
import { isImagePublishable } from "./media";
import { getPaymentProvider, orderingState, testProvider } from "./payments";

/** Every value that must be treated as the live store, including unset. */
const LIVE: Record<string, string | undefined>[] = [
  {},
  { APP_ENV: undefined },
  { APP_ENV: "" },
  { APP_ENV: "   " },
  { APP_ENV: "production" },
  { APP_ENV: "prod" },
  { APP_ENV: "live" },
  { APP_ENV: "development" },
  { APP_ENV: "stage" },
  { APP_ENV: "local-prod" },
];
const PREVIEW = ["local", "staging", "test"].map((APP_ENV) => ({ APP_ENV }));

describe("APP_ENV allowlist (A09)", () => {
  it("is a preview only for local, staging and test", () => {
    for (const env of PREVIEW) {
      expect(isPreviewEnv(env)).toBe(true);
      expect(isProductionEnv(env)).toBe(false);
    }
  });

  it("treats unset, empty, mistyped and production values as the live store", () => {
    for (const env of LIVE) {
      expect(isPreviewEnv(env)).toBe(false);
      expect(isProductionEnv(env)).toBe(true);
    }
  });

  it("ignores case and surrounding spaces", () => {
    expect(isPreviewEnv({ APP_ENV: " Staging " })).toBe(true);
    expect(isPreviewEnv({ APP_ENV: "LOCAL" })).toBe(true);
  });

  it("names what it found", () => {
    expect(appEnvKind({})).toBe("unset");
    expect(appEnvKind({ APP_ENV: "production" })).toBe("production");
    expect(appEnvKind({ APP_ENV: "staging" })).toBe("staging");
    expect(appEnvKind({ APP_ENV: "prod" })).toBe("unrecognised");
  });

  it("reads this process by default (tests run with APP_ENV=test)", () => {
    expect(process.env.APP_ENV).toBe("test");
    expect(isPreviewEnv()).toBe(true);
  });
});

describe("what the allowlist switches off", () => {
  it("offers the test payment provider only in a preview environment", () => {
    for (const env of PREVIEW) expect(getPaymentProvider(env)).toBe(testProvider);
    for (const env of LIVE) expect(getPaymentProvider(env)).toBeNull();
  });

  it("keeps ordering closed when APP_ENV is unset, so a missing variable cannot open test payments", () => {
    expect(orderingState(getPaymentProvider({}), true)).toEqual({ open: false, reason: "no_payments" });
    expect(orderingState(getPaymentProvider({ APP_ENV: "test" }), false)).toEqual({ open: true });
  });

  it("hides unapproved photos unless the environment is a preview", () => {
    const unapproved = { approvedForLaunch: false };
    for (const env of PREVIEW) expect(isImagePublishable(unapproved, env)).toBe(true);
    for (const env of LIVE) expect(isImagePublishable(unapproved, env)).toBe(false);
  });

  it("honours PREVIEW_ASSUME_STOCK only in a preview environment", () => {
    for (const env of PREVIEW) expect(previewStockEnabled({ ...env, PREVIEW_ASSUME_STOCK: "true" })).toBe(true);
    for (const env of LIVE) expect(previewStockEnabled({ ...env, PREVIEW_ASSUME_STOCK: "true" })).toBe(false);
  });
});

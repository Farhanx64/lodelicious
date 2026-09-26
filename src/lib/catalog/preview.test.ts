import { describe, expect, it } from "vitest";

import { previewStockEnabled } from "./preview";

describe("previewStockEnabled", () => {
  it("only applies in staging when explicitly switched on", () => {
    expect(previewStockEnabled({ APP_ENV: "staging", PREVIEW_ASSUME_STOCK: "true" })).toBe(true);
    expect(previewStockEnabled({ APP_ENV: "staging" })).toBe(false);
    expect(previewStockEnabled({ APP_ENV: "staging", PREVIEW_ASSUME_STOCK: "1" })).toBe(false);
  });

  it("can never apply in production", () => {
    expect(previewStockEnabled({ APP_ENV: "production", PREVIEW_ASSUME_STOCK: "true" })).toBe(false);
  });
});

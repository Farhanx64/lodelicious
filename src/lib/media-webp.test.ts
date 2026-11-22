import { describe, expect, it } from "vitest";

import { fileUrl, plannedSizes, sizeFilename } from "./media-webp";

const SPECS = [
  { name: "thumb", width: 320 },
  { name: "card", width: 720 },
  { name: "large", width: 1440 },
];

describe("WebP backfill planning (D69)", () => {
  it("names sizes the way Payload does", () => {
    expect(sizeFilename("Gift Tray.png", 720, 788)).toBe("Gift Tray-720x788.webp");
    expect(sizeFilename("noext", 320, 10)).toBe("noext-320x10.webp");
  });

  it("makes only sizes no wider than the original and not already WebP", () => {
    const doc = { id: 1, filename: "a.png", mimeType: "image/png", width: 1312, height: 1199, sizes: { thumb: { filename: "a-320x292.webp", mimeType: "image/webp" }, card: { filename: "a-720x658.png", mimeType: "image/png" } } };
    expect(plannedSizes(doc, SPECS)).toEqual([{ name: "card", width: 720, height: 658 }]);
  });

  it("skips files that aren't resizable photos", () => {
    expect(plannedSizes({ id: 2, filename: "x.svg", mimeType: "image/svg+xml", width: 100, height: 100 }, SPECS)).toEqual([]);
    expect(plannedSizes({ id: 3, filename: "x.png", mimeType: "image/png", width: null, height: null }, SPECS)).toEqual([]);
  });

  it("encodes the file URL", () => {
    expect(fileUrl("Gift Tray-720x788.webp")).toBe("/api/media/file/Gift%20Tray-720x788.webp");
  });
});

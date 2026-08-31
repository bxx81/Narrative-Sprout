import { describe, expect, test } from "bun:test";
import {
  getImageFileExtension,
  imageFileExtensions,
  type ImageMimeType,
} from "./imageFileExtensions";

describe("imageFileExtensions", () => {
  test("every ImageMimeType has an extension entry", () => {
    // Compile-time exhaustiveness is enforced by the Record type; this guards
    // against runtime drift (e.g. future malformed entries).
    for (const extension of Object.values(imageFileExtensions)) {
      expect(typeof extension).toBe("string");
      expect(extension.length).toBeGreaterThan(0);
    }
  });

  test("webp resolves to the expected extension", () => {
    const mimeType: ImageMimeType = "image/webp";
    expect(getImageFileExtension(mimeType)).toBe("webp");
  });
});

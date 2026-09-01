import { describe, expect, test } from "bun:test";
import { webpQualityForCompression } from "./assetHelpers";

describe("webpQualityForCompression", () => {
  test("normal returns 0.9", () => {
    expect(webpQualityForCompression("normal")).toBe(0.9);
  });
  test("high returns 1", () => {
    expect(webpQualityForCompression("high")).toBe(1);
  });
});

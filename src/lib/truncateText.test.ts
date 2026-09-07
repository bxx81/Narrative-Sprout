import { describe, expect, test } from "bun:test";
import { truncateText } from "./truncateText";

describe("truncateText", () => {
  test("returns short text untouched", () => {
    expect(truncateText("hello", 100)).toBe("hello");
    expect(truncateText("a".repeat(100), 100)).toBe("a".repeat(100));
  });

  test("truncates long text with an ellipsis", () => {
    expect(truncateText("a".repeat(150), 100)).toBe(`${"a".repeat(100)}…`);
  });

  test("handles tens-of-KB input", () => {
    const longTheme = "あ".repeat(30_000);
    const result = truncateText(longTheme, 100);
    expect(Array.from(result).length).toBe(101);
    expect(result.endsWith("…")).toBe(true);
  });

  test("does not split surrogate pairs or emoji", () => {
    const emoji = "😀".repeat(150);
    const result = truncateText(emoji, 100);
    expect(Array.from(result).length).toBe(101);
    expect(result.endsWith("…")).toBe(true);
  });

  test("empty and zero-length limits", () => {
    expect(truncateText("", 100)).toBe("");
    expect(truncateText("hello", 0)).toBe("");
  });
});

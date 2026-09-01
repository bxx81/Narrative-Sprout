import { describe, expect, test } from "bun:test";
import { countWords } from "./generateScene";

describe("countWords", () => {
  test("counts space-separated words", () => {
    expect(countWords("hello world")).toBe(2);
    expect(countWords("  hello   world  ")).toBe(2);
  });

  test("falls back to character count for CJK without spaces", () => {
    expect(countWords("王国は黄昏に沈みゆく")).toBe(10);
    expect(countWords("hello")).toBe(5); // single word -> fallback to char count
    expect(countWords("hello")).toBe(5);
  });

  test("handles empty and whitespace", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });

  test("counts mixed Japanese with spaces", () => {
    expect(countWords("hello 世界")).toBe(2);
  });
});

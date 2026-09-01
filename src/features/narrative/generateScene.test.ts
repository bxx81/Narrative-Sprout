import { describe, expect, test } from "bun:test";
import { countWords } from "./generateScene";

describe("countWords", () => {
  test("counts space-separated words", () => {
    expect(countWords("hello world")).toBe(2);
    expect(countWords("  hello   world  ")).toBe(2);
  });

  test("counts characters for CJK text, regardless of paragraphs", () => {
    expect(countWords("王国は黄昏に沈みゆく")).toBe(10);
    // Regression: a multi-paragraph Japanese scene used to report its
    // paragraph count (whitespace chunks) instead of a length measure.
    const multiParagraphScene =
      "王国は黄昏に沈みゆく。\n騎士は記憶を失ったまま目覚める。\n城の扉が軋みながら開いていく。";
    expect(countWords(multiParagraphScene)).toBe(42);
  });

  test("counts words for mostly non-CJK text", () => {
    expect(countWords("hello")).toBe(1);
    expect(countWords("The knight wakes up.\nHe remembers nothing.")).toBe(7);
  });

  test("handles empty and whitespace", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });

  test("counts mixed Japanese with spaces", () => {
    expect(countWords("hello 世界")).toBe(2);
  });
});

import { describe, expect, test } from "bun:test";
import { countWords, setWordCountLanguage } from "./wordCount";

describe("countWords (Intl.Segmenter, narrative language)", () => {
  test("counts word-like segments for Japanese", () => {
    setWordCountLanguage("ja");
    expect(countWords("王国は黄昏に沈みゆく")).toBe(6);
    // Punctuation and newlines are not word-like: paragraph structure does
    // not change the measure (regression: paragraph count was reported).
    const multiParagraphScene =
      "王国は黄昏に沈みゆく。\n騎士は記憶を失ったまま目覚める。\n城の扉が軋みながら開いていく。";
    expect(countWords(multiParagraphScene)).toBe(26);
  });

  test("counts words for English", () => {
    setWordCountLanguage("en");
    expect(countWords("hello world")).toBe(2);
    expect(countWords("  hello   world  ")).toBe(2);
    expect(countWords("The knight wakes up.\nHe remembers nothing.")).toBe(7);
  });

  test("counts mixed Japanese with spaces", () => {
    setWordCountLanguage("ja");
    expect(countWords("hello 世界")).toBe(2);
  });

  test("handles empty and whitespace", () => {
    setWordCountLanguage("en");
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });

  test("falls back to whitespace words without a language", () => {
    setWordCountLanguage(undefined);
    expect(countWords("hello world")).toBe(2);
    expect(countWords("王国は黄昏に沈みゆく")).toBe(1);
  });

  test("falls back to whitespace words for an invalid language tag", () => {
    setWordCountLanguage("not a language!");
    expect(countWords("hello world")).toBe(2);
  });
});

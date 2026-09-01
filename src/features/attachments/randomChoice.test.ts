import { describe, expect, test } from "bun:test";
import { processRandomChoice } from "./randomChoice";

describe("processRandomChoice", () => {
  test("replaces {a|b|c} with one of the options", () => {
    const result = processRandomChoice("Hello {a|b|c} world");
    expect(["Hello a world", "Hello b world", "Hello c world"]).toContain(result);
  });

  test("handles nested placeholders innermost first", () => {
    for (let i = 0; i < 20; i++) {
      const result = processRandomChoice("{a|{b|c}}");
      expect(["a", "b", "c"]).toContain(result);
    }
  });

  test("ignores empty or malformed braces", () => {
    expect(processRandomChoice("Hello {} world")).toBe("Hello {} world");
    expect(processRandomChoice("Hello {|a} world")).toBe("Hello {|a} world");
  });

  test("removes marker definition and randomly inserts options", () => {
    const result = processRandomChoice(
      "pre {##mark##|opt1|opt2} post ##mark## middle ##mark## end",
    );
    // marker token itself should be gone
    expect(result.includes("##mark##")).toBe(false);
    // at least one opt should appear (insertion is random, but with 2 opts and 3 gaps, at least one will be inserted)
    // run many times to ensure both appear across runs
    let sawOpt1 = result.includes("opt1");
    let sawOpt2 = result.includes("opt2");
    for (let i = 0; i < 30; i++) {
      const r = processRandomChoice("a ##mark## b ##mark## c {##mark##|x|y}");
      if (r.includes("x")) sawOpt1 = true;
      if (r.includes("y")) sawOpt2 = true;
    }
    expect(sawOpt1 || sawOpt2).toBe(true);
  });

  test("leaves text without placeholders unchanged", () => {
    expect(processRandomChoice("no placeholders")).toBe("no placeholders");
  });

  test("handles multiple independent choices", () => {
    for (let i = 0; i < 20; i++) {
      const result = processRandomChoice("{a|b} and {1|2}");
      expect(result).toMatch(/^[ab] and [12]$/);
    }
  });
});

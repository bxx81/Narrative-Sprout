import { describe, expect, test } from "bun:test";
import { applyMemoryDelta } from "./memoryMerge";

describe("applyMemoryDelta", () => {
  test("sets new keys and appends the summary", () => {
    const next = applyMemoryDelta(
      { notes: {}, storyLog: [] },
      { notes: { "char:Elara": "a knight" }, sceneSummary: "出会い" },
    );
    expect(next.notes["char:Elara"]).toBe("a knight");
    expect(next.storyLog).toEqual(["出会い"]);
  });

  test("null deletes a key; unchanged keys survive", () => {
    const next = applyMemoryDelta(
      { notes: { "char:A": "x", "status:A": "running" }, storyLog: ["old"] },
      { notes: { "status:A": null }, sceneSummary: "new" },
    );
    expect(next.notes).toEqual({ "char:A": "x" });
    expect(next.storyLog).toEqual(["old", "new"]);
  });

  test("does not mutate the input", () => {
    const memory = { notes: { "flag:x": "1" }, storyLog: ["a"] };
    applyMemoryDelta(memory, { notes: { "flag:x": null }, sceneSummary: "b" });
    expect(memory.notes).toEqual({ "flag:x": "1" });
    expect(memory.storyLog).toEqual(["a"]);
  });
});

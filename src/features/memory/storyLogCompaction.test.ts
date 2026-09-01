import { describe, expect, test } from "bun:test";
import {
  compactMemory,
  mergeArchivedFacts,
  shouldCompactStoryLog,
  splitStoryLog,
  RECENT_STORY_LOG_COUNT,
  STORY_LOG_ARCHIVE_THRESHOLD,
} from "./storyLogCompaction";

describe("splitStoryLog", () => {
  test("keeps all when under recent count", () => {
    const log = Array.from({ length: 10 }, (_, i) => `event ${i}`);
    const { older, recent } = splitStoryLog(log);
    expect(older).toEqual([]);
    expect(recent).toEqual(log);
  });

  test("splits correctly when over recent count", () => {
    const log = Array.from({ length: 35 }, (_, i) => `event ${i}`);
    const { older, recent } = splitStoryLog(log);
    expect(older).toHaveLength(15);
    expect(recent).toHaveLength(RECENT_STORY_LOG_COUNT);
    expect(recent[0]).toBe("event 15");
  });

  test("exactly at threshold keeps 20", () => {
    const log = Array.from({ length: RECENT_STORY_LOG_COUNT }, (_, i) => `${i}`);
    const { older, recent } = splitStoryLog(log);
    expect(older).toHaveLength(0);
    expect(recent).toHaveLength(RECENT_STORY_LOG_COUNT);
  });
});

describe("shouldCompactStoryLog", () => {
  test("returns true when over threshold", () => {
    const log = Array.from({ length: STORY_LOG_ARCHIVE_THRESHOLD + 1 }, () => "x");
    expect(shouldCompactStoryLog(log)).toBe(true);
  });
  test("returns false when at or under threshold", () => {
    expect(shouldCompactStoryLog(Array(STORY_LOG_ARCHIVE_THRESHOLD).fill("x"))).toBe(false);
    expect(shouldCompactStoryLog([])).toBe(false);
  });
});

describe("mergeArchivedFacts", () => {
  test("merges only flag/num/lore, ignores others", () => {
    const notes = { "flag:a": "1" };
    const facts = {
      "flag:b": "2",
      "num:gold": "100",
      "lore:war": "old",
      "char:hero": "x",
      "status:hero": "y",
    };
    const merged = mergeArchivedFacts(notes, facts);
    expect(merged).toEqual({ "flag:a": "1", "flag:b": "2", "num:gold": "100", "lore:war": "old" });
  });

  test("does not overwrite existing keys", () => {
    const notes = { "flag:a": "original" };
    const facts = { "flag:a": "new", "flag:c": "c" };
    const merged = mergeArchivedFacts(notes, facts);
    expect(merged["flag:a"]).toBe("original");
    expect(merged["flag:c"]).toBe("c");
  });

  test("ignores null values", () => {
    const notes = {};
    const facts = { "flag:a": null, "flag:b": "2" } as Record<string, string | null>;
    const merged = mergeArchivedFacts(notes, facts);
    expect(merged).toEqual({ "flag:b": "2" });
  });

  test("returns same reference when nothing merged", () => {
    const notes = { "flag:a": "1" };
    const merged = mergeArchivedFacts(notes, { "char:x": "y" });
    expect(merged).toBe(notes);
  });

  test("handles undefined facts", () => {
    const notes = { "flag:a": "1" };
    expect(mergeArchivedFacts(notes, undefined)).toBe(notes);
  });
});

describe("compactMemory", () => {
  test("keeps recent, sets summary, merges facts", () => {
    const log = Array.from({ length: 35 }, (_, i) => `event ${i}`);
    const memory = {
      notes: { "flag:a": "1", "status:hero": "running" },
      storyLog: log,
      storyLogSummary: "old",
    };
    const compacted = compactMemory(memory, "new summary", { "flag:b": "2" });
    expect(compacted.storyLog).toHaveLength(RECENT_STORY_LOG_COUNT);
    expect(compacted.storyLogSummary).toBe("new summary");
    expect(compacted.notes["flag:b"]).toBe("2");
    expect(compacted.notes["flag:a"]).toBe("1");
  });

  test("does not mutate input", () => {
    const log = Array.from({ length: 35 }, () => "x");
    const memory = { notes: {}, storyLog: log };
    const copy = { ...memory, storyLog: [...log] };
    compactMemory(memory, "s", {});
    expect(memory.storyLog).toEqual(copy.storyLog);
  });

  test("preserves notes when no facts", () => {
    const log = Array.from({ length: 35 }, () => "x");
    const memory = { notes: { "flag:a": "1" }, storyLog: log };
    const compacted = compactMemory(memory, "s", undefined);
    expect(compacted.notes).toEqual({ "flag:a": "1" });
  });
});

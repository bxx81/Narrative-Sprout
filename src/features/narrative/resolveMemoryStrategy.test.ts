import { describe, expect, test } from "bun:test";
import { resolveMemoryStrategy } from "./resolveMemoryStrategy";

describe("resolveMemoryStrategy", () => {
  test("split is always split", () => {
    expect(resolveMemoryStrategy("split", "short")).toBe("split");
    expect(resolveMemoryStrategy("split", "novel")).toBe("split");
  });

  test("single is always single", () => {
    expect(resolveMemoryStrategy("single", "novel")).toBe("single");
    expect(resolveMemoryStrategy("single", "novel2")).toBe("single");
  });

  test("auto splits only for novel/novel2", () => {
    expect(resolveMemoryStrategy("auto", "novel")).toBe("split");
    expect(resolveMemoryStrategy("auto", "novel2")).toBe("split");
    expect(resolveMemoryStrategy("auto", "medium")).toBe("single");
    expect(resolveMemoryStrategy("auto", "short")).toBe("single");
    expect(resolveMemoryStrategy("auto", "detailed")).toBe("single");
    expect(resolveMemoryStrategy("auto", "verbose")).toBe("single");
  });

  test("undefined defaults to single", () => {
    expect(resolveMemoryStrategy(undefined, "novel")).toBe("single");
    expect(resolveMemoryStrategy(undefined, "medium")).toBe("single");
  });
});

import { describe, expect, test } from "bun:test";
import type { StoryNodeRecord } from "../../types";
import { collectAncestors, applyHistoryContextCut } from "./treeTraversal";

function node(id: string, parentNodeId: string | null, turnNumber: number): StoryNodeRecord {
  return {
    id: id as StoryNodeRecord["id"],
    gameId: "g" as StoryNodeRecord["gameId"],
    parentNodeId: parentNodeId as StoryNodeRecord["parentNodeId"],
    turnNumber,
    choiceText: null,
    scene: {
      reasoning: "",
      sceneText: "",
      sceneWordCount: 0,
      imagePrompt: "",
      negativeImagePrompt: "",
      choices: [],
      isStoryOver: false,
      storyClosingText: "",
      locationContext: "",
    },
    promptSent: "",
    memory: { notes: {}, storyLog: [] },
    memoryDelta: { notes: {}, sceneSummary: "" },
    metadata: {
      generationCost: null,
      modelName: null,
      discardHistoryContext: false,
      refinePrompt: null,
      refinedFromNodeId: null,
    },
    createdAt: "",
  };
}

describe("collectAncestors", () => {
  const nodes = new Map(
    [node("root", null, 1), node("a", "root", 2), node("b", "a", 3)].map((n) => [n.id, n]),
  );

  const ids = (list: StoryNodeRecord[]) => list.map((n) => n.id as string);

  test("includeSelf returns self then parents, newest first", () => {
    expect(ids(collectAncestors(nodes, "b", true))).toEqual(["b", "a", "root"]);
  });

  test("excluding self starts at the parent", () => {
    expect(ids(collectAncestors(nodes, "b"))).toEqual(["a", "root"]);
  });

  test("root with includeSelf=false is empty", () => {
    expect(collectAncestors(nodes, "root")).toEqual([]);
  });
});

describe("applyHistoryContextCut (permanent discardHistoryContext cut)", () => {
  function flagged(n: StoryNodeRecord): StoryNodeRecord {
    return { ...n, metadata: { ...n.metadata, discardHistoryContext: true } };
  }

  const chain = [node("b", "a", 3), node("a", "root", 2), node("root", null, 1)];

  test("keeps the whole chain when no node carries the flag", () => {
    expect(applyHistoryContextCut(chain).map((n) => n.id as string)).toEqual(["b", "a", "root"]);
  });

  test("keeps nodes until and including the flagged node, cutting older ones", () => {
    const cutChain = [chain[0]!, flagged(chain[1]!), chain[2]!];
    expect(applyHistoryContextCut(cutChain).map((n) => n.id as string)).toEqual(["b", "a"]);
  });

  test("a flag on the newest node cuts everything else immediately", () => {
    const cutChain = [flagged(chain[0]!), chain[1]!, chain[2]!];
    expect(applyHistoryContextCut(cutChain).map((n) => n.id as string)).toEqual(["b"]);
  });
});

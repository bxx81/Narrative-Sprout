import { describe, expect, test } from "bun:test";
import type { StoryNodeRecord } from "../../types";

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

import { collectNodesToDelete } from "./branchDeletion";

describe("branch deletion logic", () => {
  test("deletes leaf linear chain up to branching point", () => {
    // tree: root -> a -> b -> c (linear)
    const nodes = [
      node("root", null, 1),
      node("a", "root", 2),
      node("b", "a", 3),
      node("c", "b", 4),
    ];
    expect(collectNodesToDelete(nodes, "c")).toEqual(new Set(["c", "b", "a", "root"]));
  });

  test("stops at branching point where parent has another child", () => {
    // root -> a -> b -> c
    //        a also has child b2
    const nodes = [
      node("root", null, 1),
      node("a", "root", 2),
      node("b", "a", 3),
      node("b2", "a", 3),
      node("c", "b", 4),
    ];
    // deleting c (leaf under b): b has only c, so c+b deleted, a has b2, so stop
    expect(collectNodesToDelete(nodes, "c")).toEqual(new Set(["c", "b"]));
  });

  test("deleting internal node also deletes its descendants (subtree)", () => {
    // b has child c and c2
    const nodes = [
      node("root", null, 1),
      node("a", "root", 2),
      node("b", "a", 3),
      node("b2", "a", 3),
      node("c", "b", 4),
      node("c2", "b", 4),
    ];
    // deleting b should delete b and its entire subtree c,c2, but not b2
    expect(collectNodesToDelete(nodes, "b")).toEqual(new Set(["b", "c", "c2"]));
  });

  test("deleting leaf with sibling keeps sibling branch", () => {
    // root has children a and a2, a has child b
    const nodes = [
      node("root", null, 1),
      node("a", "root", 2),
      node("a2", "root", 2),
      node("b", "a", 3),
    ];
    // deleting b should delete b and a (a only has b), root has a2 so stop
    expect(collectNodesToDelete(nodes, "b")).toEqual(new Set(["b", "a"]));
  });

  test("deleting root when it's the only node deletes root", () => {
    const nodes = [node("root", null, 1)];
    expect(collectNodesToDelete(nodes, "root")).toEqual(new Set(["root"]));
  });

  test("deleting root with multiple branches deletes entire tree", () => {
    const nodes = [
      node("root", null, 1),
      node("a", "root", 2),
      node("b", "root", 2),
      node("c", "a", 3),
    ];
    expect(collectNodesToDelete(nodes, "root")).toEqual(new Set(["root", "a", "b", "c"]));
  });

  test("unknown endNodeId returns empty", () => {
    const nodes = [node("root", null, 1)];
    expect(collectNodesToDelete(nodes, "missing")).toEqual(new Set());
  });
});

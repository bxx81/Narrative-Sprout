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

/**
 * Pure helper extracted from gameRepository.deleteBranch logic
 * (determine nodesToDelete by walking up while parent has no other live children).
 */
function determineNodesToDelete(allNodes: StoryNodeRecord[], endNodeId: string): Set<string> {
  const byId = new Map<string, StoryNodeRecord>(allNodes.map((n) => [n.id as string, n]));
  const byParent = new Map<string, StoryNodeRecord[]>();
  for (const n of allNodes) {
    if (n.parentNodeId) {
      const key = n.parentNodeId as string;
      const list = byParent.get(key) ?? [];
      list.push(n);
      byParent.set(key, list);
    }
  }
  const nodesToDelete = new Set<string>();
  let currentId: string | null = endNodeId;
  while (currentId) {
    const current = byId.get(currentId);
    if (!current) break;
    nodesToDelete.add(currentId);
    const parentId = current.parentNodeId as string | null;
    if (!parentId) break;
    const siblings = (byParent.get(parentId) ?? []).filter(
      (n) => n.id !== currentId && !nodesToDelete.has(n.id as string),
    );
    if (siblings.length > 0) break;
    currentId = parentId;
  }
  return nodesToDelete;
}

describe("branch deletion logic", () => {
  test("deletes leaf linear chain up to branching point", () => {
    // tree: root -> a -> b -> c (linear)
    const nodes = [
      node("root", null, 1),
      node("a", "root", 2),
      node("b", "a", 3),
      node("c", "b", 4),
    ];
    // deleting c should delete c, b, a, root? Actually while loop stops when parent has siblings, but linear has no siblings, so it deletes all the way to root.
    // In gameRepository, it deletes until parent has other children; linear means all nodes deleted.
    expect(determineNodesToDelete(nodes, "c")).toEqual(new Set(["c", "b", "a", "root"]));
  });

  test("stops at branching point where parent has another child", () => {
    // root -> a -> b
    //        -> a2 (sibling of b? Actually a's children: b and b2)
    // root has child a, a has children b, b2
    const nodes = [
      node("root", null, 1),
      node("a", "root", 2),
      node("b", "a", 3),
      node("b2", "a", 3),
      node("c", "b", 4),
    ];
    // deleting c (leaf under b): b has no other children except c? Actually b's only child is c, so c and b should be deleted, but a has another child b2, so stop at a.
    expect(determineNodesToDelete(nodes, "c")).toEqual(new Set(["c", "b"]));
    // deleting b directly (which has child c): should delete b and c? Wait endNodeId is b, but b has child c not in nodesToDelete yet. The logic walks up from endNodeId, not down. So deleting b (internal node) would delete b and if a has another child b2, stop.
    // But c is child of b, not parent, so deleting b should not automatically delete c (c is descendant). However our determineNodesToDelete only walks up, not down. Legacy deleteBranch actually collects nodesToDelete by walking up from endNodeId, but it also should delete descendants? In legacy, endNodeId is the leaf to delete, so its descendants are just itself? Actually endNodeId is the end of branch to delete, which is a leaf, so no descendants. So this is correct.
  });

  test("deleting leaf with sibling keeps sibling branch", () => {
    // root -> a -> b
    //      -> a has siblings? Actually root's children: a and a2
    const nodes = [
      node("root", null, 1),
      node("a", "root", 2),
      node("a2", "root", 2),
      node("b", "a", 3),
    ];
    // deleting b should delete b and a (since a's only child is b), but root has another child a2, so stop before root
    expect(determineNodesToDelete(nodes, "b")).toEqual(new Set(["b", "a"]));
  });

  test("deleting root when it's the only node deletes root", () => {
    const nodes = [node("root", null, 1)];
    expect(determineNodesToDelete(nodes, "root")).toEqual(new Set(["root"]));
  });

  test("unknown endNodeId returns empty", () => {
    const nodes = [node("root", null, 1)];
    expect(determineNodesToDelete(nodes, "missing")).toEqual(new Set());
  });
});

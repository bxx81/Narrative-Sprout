import type { StoryNodeRecord } from "../../types";

/**
 * Determines the set of node IDs to delete when removing a branch
 * rooted at `endNodeId`.
 *
 * 1. Collects the entire subtree of `endNodeId` (including itself and all descendants).
 * 2. Walks upward from the subtree root's parent while the parent has no
 *    other children outside the deletion set — i.e., the parent would become
 *    orphaned and is therefore also deleted.
 *
 * This matches the intended UX: deleting a branch removes its whole
 * sub-tree, and if the parent then has no remaining children, the parent
 * itself is also removed (up to the branching point).
 */
export function collectNodesToDelete(allNodes: StoryNodeRecord[], endNodeId: string): Set<string> {
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

  const endNode = byId.get(endNodeId);
  if (!endNode) return new Set();

  // 1. Collect subtree of endNodeId
  const nodesToDelete = new Set<string>();
  const queue: string[] = [endNodeId];
  nodesToDelete.add(endNodeId);
  while (queue.length > 0) {
    const current = queue.pop()!;
    const children = byParent.get(current) ?? [];
    for (const child of children) {
      const childId = child.id as string;
      if (!nodesToDelete.has(childId)) {
        nodesToDelete.add(childId);
        queue.push(childId);
      }
    }
  }

  // 2. Walk upward from the original endNode's parent
  let currentParentId = endNode.parentNodeId as string | null;
  while (currentParentId) {
    const parent = byId.get(currentParentId);
    if (!parent) break;
    const siblings = (byParent.get(currentParentId) ?? []).filter(
      (n) => !nodesToDelete.has(n.id as string),
    );
    if (siblings.length > 0) break;
    // Parent has no remaining children -> delete it as well
    nodesToDelete.add(currentParentId);
    currentParentId = parent.parentNodeId as string | null;
  }

  return nodesToDelete;
}

import type { MemoryState } from "../../types";
import type { StoryNodeRecord } from "../../types";

/**
 * Walks from `node` up to the root, returning ancestors NEWEST first
 * (excluding `node` itself is the caller's choice via `includeSelf`).
 */
export function collectAncestors(
  byId: Map<string, StoryNodeRecord>,
  startId: string,
  includeSelf = false,
): StoryNodeRecord[] {
  const result: StoryNodeRecord[] = [];
  let current = byId.get(startId);
  if (!includeSelf && current?.parentNodeId) {
    current = byId.get(current.parentNodeId);
  } else if (!includeSelf) {
    return [];
  }
  while (current) {
    result.push(current);
    current = current.parentNodeId ? byId.get(current.parentNodeId) : undefined;
  }
  return result;
}

/**
 * Applies the permanent history cut (legacy `discardHistoryContext`): keeps
 * ancestors NEWEST first until — and including — the first node carrying
 * `metadata.discardHistoryContext`; everything older than that node is
 * excluded from prompt history. The memory prefix is NOT affected (legacy
 * kept the monologue summary across the cut).
 */
export function applyHistoryContextCut(ancestors: StoryNodeRecord[]): StoryNodeRecord[] {
  const result: StoryNodeRecord[] = [];
  for (const node of ancestors) {
    result.push(node);
    if (node.metadata.discardHistoryContext) break;
  }
  return result;
}

/** Memory state to use as the base for the NEXT turn = the parent's memory. */
export function baseMemoryForNewNode(parent: StoryNodeRecord | null): MemoryState {
  return parent?.memory ?? { notes: {}, storyLog: [] };
}

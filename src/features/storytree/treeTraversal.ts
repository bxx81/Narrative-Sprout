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

/** Memory state to use as the base for the NEXT turn = the parent's memory. */
export function baseMemoryForNewNode(parent: StoryNodeRecord | null): MemoryState {
  return parent?.memory ?? { notes: {}, storyLog: [] };
}

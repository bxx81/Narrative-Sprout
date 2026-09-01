import { useMemo } from "react";
import type { StoryNodeId, StoryNodeRecord } from "../types";
import { useGameStore } from "../store/gameStore";

const getPathToNode = (byId: Map<string, StoryNodeRecord>, nodeId: string): StoryNodeId[] => {
  const path: StoryNodeId[] = [];
  let currentId: string | null = nodeId;
  while (currentId) {
    const node = byId.get(currentId);
    if (!node) break;
    path.unshift(node.id);
    currentId = node.parentNodeId;
  }
  return path;
};

/**
 * Scene history navigation along the remembered path from the branch root to
 * its end node (`currentNodeId`, the playhead — where Forward leads).
 * Viewing can sit anywhere on that path; Back/Forward walk it step by step.
 * v2 port of the legacy hook; state comes from the game store.
 */
export const useGameNavigation = () => {
  const nodes = useGameStore((s) => s.nodes);
  const viewingNodeId = useGameStore((s) => s.viewingNodeId);
  const currentNodeId = useGameStore((s) => s.currentNodeId);
  const latestNodeId = useGameStore((s) => s.activeGame?.latestNodeId ?? null);
  const setViewingNode = useGameStore((s) => s.setViewingNode);

  // The playhead is the navigation endpoint; fall back to the save's latest
  // node until it is established.
  const pathEndNodeId = currentNodeId ?? latestNodeId;

  return useMemo(() => {
    if (!viewingNodeId || !pathEndNodeId) {
      return {
        canGoBack: false,
        canGoForward: false,
        isAtLatest: true,
        onNavigateBack: () => {},
        onNavigateForward: () => {},
        onGoToLatest: () => {},
      };
    }
    const byId = new Map(nodes.map((n) => [n.id, n]));
    // The store types ids as plain strings; records carry the branded type.
    const viewingId = viewingNodeId as StoryNodeId | null;
    // The remembered route: root -> ... -> path end. The viewing node's
    // position IN this path decides whether Back/Forward are enabled.
    const path = getPathToNode(byId, pathEndNodeId as StoryNodeId);
    const currentIndex = viewingId ? path.indexOf(viewingId) : -1;

    return {
      canGoBack: currentIndex > 0,
      canGoForward: currentIndex !== -1 && currentIndex < path.length - 1,
      isAtLatest: viewingNodeId === pathEndNodeId,
      onNavigateBack: () => {
        const node = viewingId ? byId.get(viewingId) : undefined;
        if (node?.parentNodeId) setViewingNode(node.parentNodeId);
      },
      onNavigateForward: () => {
        if (currentIndex > -1 && currentIndex < path.length - 1) {
          setViewingNode(path[currentIndex + 1]!);
        }
      },
      onGoToLatest: () => {
        setViewingNode(pathEndNodeId);
      },
    };
  }, [nodes, viewingNodeId, pathEndNodeId, setViewingNode]);
};

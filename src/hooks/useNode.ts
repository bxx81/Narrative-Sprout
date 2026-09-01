import { useEffect, useState } from "react";
import { gameRepository } from "../db/gameRepository";
import type { StoryNodeRecord } from "../types";

/**
 * Loads a single node record (e.g., a save's latest node for card previews).
 * UI-data adapter; writes still go through store actions only.
 */
export const useNode = (nodeId: string | null | undefined) => {
  const [node, setNode] = useState<StoryNodeRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!nodeId) {
      setNode(null);
      return;
    }
    void gameRepository.getNode(nodeId).then((record) => {
      if (!cancelled) setNode(record ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  return node;
};

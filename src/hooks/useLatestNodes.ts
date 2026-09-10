import { useEffect, useRef, useState } from "react";
import { gameRepository } from "../db/gameRepository";
import type { StoryNodeRecord } from "../types";

/**
 * Bulk-resolves latest-node previews for the save list.
 *
 * Replaces per-card `useNode(game.latestNodeId)` (N IndexedDB round-trips)
 * with one `bulkGet` per visible page. Results are cached in a ref so
 * growing the visible window only fetches the newly revealed ids.
 */
export const useLatestNodes = (latestNodeIds: (string | null | undefined)[]) => {
  const [nodeMap, setNodeMap] = useState<Map<string, StoryNodeRecord>>(new Map());
  const cacheRef = useRef<Map<string, StoryNodeRecord>>(new Map());

  const key = latestNodeIds.filter((id): id is string => !!id).join("\0");

  useEffect(() => {
    const ids = [...new Set(key.length > 0 ? key.split("\0") : [])].filter(
      (id) => !cacheRef.current.has(id),
    );
    if (ids.length === 0) {
      setNodeMap(new Map(cacheRef.current));
      return;
    }
    let cancelled = false;
    void gameRepository
      .bulkGetNodes(ids)
      .then((records) => {
        if (cancelled) return;
        for (const record of records) cacheRef.current.set(record.id, record);
        setNodeMap(new Map(cacheRef.current));
      })
      .catch(() => {
        if (!cancelled) setNodeMap(new Map(cacheRef.current));
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return nodeMap;
};

import { db } from "./database";
import type { AssetRecord } from "../types/asset";
import type { GameRecord, StoryNodeRecord } from "../types";

/**
 * Repository for `games` / `nodes` stores (REDESIGN §5.1).
 * Store actions call these; components never touch the db directly.
 * Node/asset deletion is always transactional (REDESIGN §5.3 / AGENTS rule 7).
 */
export const gameRepository = {
  async createGame(
    game: GameRecord,
    rootNode: StoryNodeRecord,
    asset?: AssetRecord | null,
  ): Promise<void> {
    await db.transaction("rw", [db.games, db.nodes, db.assets], async () => {
      await db.games.add(game);
      await db.nodes.add(rootNode);
      if (asset) await db.assets.put(asset);
    });
  },

  async appendNode(
    node: StoryNodeRecord,
    updatedGame: GameRecord,
    asset?: AssetRecord | null,
  ): Promise<void> {
    await db.transaction("rw", [db.games, db.nodes, db.assets], async () => {
      await db.nodes.add(node);
      await db.games.put(updatedGame);
      if (asset) await db.assets.put(asset);
    });
  },

  /** Atomically overwrites an asset (image regeneration) — same key. */
  async putAsset(asset: AssetRecord): Promise<void> {
    await db.assets.put(asset);
  },

  async listGames(): Promise<GameRecord[]> {
    return db.games.orderBy("lastPlayedAt").reverse().toArray();
  },

  async getGame(gameId: string): Promise<GameRecord | undefined> {
    return db.games.get(gameId);
  },

  async getNode(nodeId: string): Promise<StoryNodeRecord | undefined> {
    return db.nodes.get(nodeId);
  },

  /** All nodes of a game in play order. */
  async getNodesOfGame(gameId: string): Promise<StoryNodeRecord[]> {
    return db.nodes.where("gameId").equals(gameId).sortBy("turnNumber");
  },

  /**
   * Deletes a branch from `endNodeId` upward, stopping when a node has
   * siblings (another child of the same parent). Deletes nodes and their
   * assets in one transaction (orphan-safe by construction).
   * Returns the updated GameRecord or `null` if the entire game was deleted.
   */
  async deleteBranch(gameId: string, endNodeId: string): Promise<GameRecord | null> {
    const allNodes = await db.nodes.where("gameId").equals(gameId).toArray();
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
      const parentId = current.parentNodeId;
      if (!parentId) break;
      const siblings = (byParent.get(parentId) ?? []).filter(
        (n) => n.id !== currentId && !nodesToDelete.has(n.id),
      );
      if (siblings.length > 0) break;
      currentId = parentId;
    }

    const remainingNodes = allNodes.filter((n) => !nodesToDelete.has(n.id));
    if (remainingNodes.length === 0) {
      // Delete entire game + all its assets
      await db.transaction("rw", [db.games, db.nodes, db.assets], async () => {
        await db.games.delete(gameId);
        await db.nodes.where("gameId").equals(gameId).delete();
        await db.assets.bulkDelete([...nodesToDelete] as string[]);
      });
      return null;
    }

    // Find latest node among remaining (by turnNumber) for latestNodeId
    const latest = remainingNodes.reduce((a, b) => (a.turnNumber > b.turnNumber ? a : b));
    const game = await db.games.get(gameId);
    if (!game) return null;
    const updatedGame: GameRecord = {
      ...game,
      latestNodeId: latest.id as GameRecord["latestNodeId"],
      lastPlayedAt: new Date().toISOString(),
    };

    await db.transaction("rw", [db.games, db.nodes, db.assets], async () => {
      await db.nodes.bulkDelete([...nodesToDelete] as string[]);
      await db.assets.bulkDelete([...nodesToDelete] as string[]);
      await db.games.put(updatedGame);
    });
    return updatedGame;
  },

  async deleteGame(gameId: string): Promise<void> {
    const nodes = await db.nodes.where("gameId").equals(gameId).toArray();
    const nodeIds = nodes.map((n) => n.id);
    await db.transaction("rw", [db.games, db.nodes, db.assets], async () => {
      await db.games.delete(gameId);
      await db.nodes.where("gameId").equals(gameId).delete();
      await db.assets.bulkDelete(nodeIds as string[]);
    });
  },
};

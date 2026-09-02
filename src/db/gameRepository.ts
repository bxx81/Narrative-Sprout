import { db } from "./database";
import { collectNodesToDelete } from "../features/storytree/branchDeletion";
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

  /**
   * In-place scene text rewrite (manual editing, legacy UPDATE_SCENE): the
   * same node keeps its position in the tree; the next turn's prompt history
   * rebuilds from the stored scene, so edits flow into future generations.
   * `sceneWordCount` is refreshed so the divider stays consistent.
   */
  async updateNodeSceneText(
    nodeId: string,
    sceneText: string,
    sceneWordCount: number,
  ): Promise<void> {
    await db.transaction("rw", db.nodes, async () => {
      const node = await db.nodes.get(nodeId);
      if (!node) return;
      await db.nodes.put({ ...node, scene: { ...node.scene, sceneText, sceneWordCount } });
    });
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
   * Deletes a branch rooted at `endNodeId` (including its entire subtree)
   * and then walks upward while the parent would become childless.
   * All deletions are transactional with assets (REDESIGN §5.3).
   * Returns the updated GameRecord or `null` if the entire game was deleted.
   */
  async deleteBranch(gameId: string, endNodeId: string): Promise<GameRecord | null> {
    const allNodes = await db.nodes.where("gameId").equals(gameId).toArray();
    const nodesToDelete = collectNodesToDelete(allNodes, endNodeId);

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

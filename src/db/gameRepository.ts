import { db } from "./database";
import type { GameRecord, StoryNodeRecord } from "../types";

/**
 * Repository for `games` / `nodes` stores (REDESIGN §5.1).
 * Store actions call these; components never touch the db directly.
 */
export const gameRepository = {
  async createGame(game: GameRecord, rootNode: StoryNodeRecord): Promise<void> {
    await db.transaction("rw", [db.games, db.nodes], async () => {
      await db.games.add(game);
      await db.nodes.add(rootNode);
    });
  },

  async appendNode(node: StoryNodeRecord, updatedGame: GameRecord): Promise<void> {
    await db.transaction("rw", [db.games, db.nodes], async () => {
      await db.nodes.add(node);
      await db.games.put(updatedGame);
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
};

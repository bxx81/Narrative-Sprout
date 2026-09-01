import { db } from "./database";
import type { AssetRecord } from "../types/asset";
import type { GameRecord, StoryNodeRecord } from "../types";
import type { SettingsRecord } from "../types/settings";

/**
 * Transactional upsert of restored/imported records (REDESIGN §5.1, §5.7).
 *
 * Restore merges by primary key: existing games/nodes/assets with the same
 * ids are overwritten, everything else is added. Nothing pre-existing is
 * deleted (non-destructive policy). Validation has already happened in the
 * backup feature; this module only persists what it is given.
 */
export const restoreRepository = {
  async upsertRestoredData(restored: {
    games: GameRecord[];
    nodes: StoryNodeRecord[];
    assets: AssetRecord[];
    settings: SettingsRecord | null;
  }): Promise<{
    restoredGameCount: number;
    restoredNodeCount: number;
    restoredAssetCount: number;
    settingsRestored: boolean;
  }> {
    const { games, nodes, assets, settings } = restored;
    await db.transaction("rw", [db.games, db.nodes, db.assets, db.settings], async () => {
      await db.games.bulkPut(games);
      await db.nodes.bulkPut(nodes);
      await db.assets.bulkPut(assets);
      if (settings) await db.settings.put(settings);
    });
    return {
      restoredGameCount: games.length,
      restoredNodeCount: nodes.length,
      restoredAssetCount: assets.length,
      settingsRestored: settings !== null,
    };
  },
};

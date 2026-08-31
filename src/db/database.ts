import Dexie, { type Table } from "dexie";
import type { AssetRecord } from "../types/asset";
import type { CredentialRecord } from "../types/credential";
import type { GameRecord, StoryNodeRecord } from "../types/game";
import type { SettingsRecord } from "../types/settings";

/**
 * IndexedDB layout (REDESIGN.md §5.1).
 *
 * Design notes:
 * - `nodes` are individual records (not one giant JSON) for fault locality.
 * - `assets` is keyed 1:1 by nodeId; node/asset deletion must share a
 *   transaction (§5.3).
 * - `credentials` is the ONLY place secrets live; export/backup code must
 *   never read from it (§5.4).
 */
export class NarrativeSproutDatabase extends Dexie {
  games!: Table<GameRecord, string>;
  nodes!: Table<StoryNodeRecord, string>;
  assets!: Table<AssetRecord, string>;
  settings!: Table<SettingsRecord, string>;
  credentials!: Table<CredentialRecord, string>;

  constructor(name = "narrative-sprout") {
    super(name);
    // Index policy: keep minimal. Compound [gameId+turnNumber] for
    // chronological scans, parentNodeId for child enumeration.
    this.version(1).stores({
      games: "id, lastPlayedAt",
      nodes: "id, gameId, parentNodeId, [gameId+turnNumber]",
      assets: "nodeId",
      settings: "key",
      credentials: "key",
    });
  }
}

export const db = new NarrativeSproutDatabase();

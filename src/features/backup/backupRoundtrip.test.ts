import { describe, expect, test } from "bun:test";
import { db } from "../../db/database";
import { gameRepository } from "../../db/gameRepository";
import { settingsRepository } from "../../db/settingsRepository";
import { createBackupFile } from "./createBackup";
import { restoreBackupFromEnvelopeText } from "./restoreBackup";
import {
  makeTestAsset,
  makeTestGame,
  makeTestNode,
  makeTestSettings,
  wipeDatabaseForTest,
} from "./testsupport/records";

describe("encrypted backup roundtrip (REDESIGN §3.3)", () => {
  test("backup → wipe → restore brings back games, nodes, assets and settings", async () => {
    // Isolate from any data other test files may have left in the DB.
    await wipeDatabaseForTest();

    const game = makeTestGame("game-1", "きみと歩む夏の物語");
    const node1 = makeTestNode("game-1", "game-1-node-1", 1);
    const node2 = makeTestNode("game-1", "game-1-node-2", 2);
    const asset = makeTestAsset("game-1-node-1", [137, 80, 78, 71, 1, 2, 3]);

    await db.transaction("rw", [db.games, db.nodes, db.assets, db.settings], async () => {
      await db.games.put(game);
      await db.nodes.bulkPut([node1, node2]);
      await db.assets.put(asset);
      await db.settings.put(makeTestSettings());
    });

    const { fileName, blob } = await createBackupFile("correct horse battery");
    expect(fileName.startsWith("ns-backup_")).toBe(true);
    expect(fileName.endsWith(".nsbak")).toBe(true);

    // Wipe the whole database (factory reset) — restore must rebuild it.
    await wipeDatabaseForTest();

    // A decoy save created after the backup must survive the restore (merge).
    const decoy = makeTestGame("game-decoy", "復元前に作ったセーブ");
    const decoyNode = makeTestNode("game-decoy", "game-decoy-node-1", 1);
    await db.transaction("rw", [db.games, db.nodes], async () => {
      await db.games.put(decoy);
      await db.nodes.put(decoyNode);
    });

    const summary = await restoreBackupFromEnvelopeText(await blob.text(), "correct horse battery");
    expect(summary.restoredGameCount).toBe(1);
    expect(summary.restoredNodeCount).toBe(2);
    expect(summary.restoredAssetCount).toBe(1);
    expect(summary.settingsRestored).toBe(true);

    const games = await gameRepository.listGames();
    expect(games.map((g) => g.id as string).sort()).toEqual(["game-1", "game-decoy"]);

    const restoredNodes = await gameRepository.getNodesOfGame("game-1");
    expect(JSON.parse(JSON.stringify(restoredNodes))).toEqual(
      JSON.parse(JSON.stringify([node1, node2])),
    );

    const restoredAsset = await db.assets.get("game-1-node-1");
    expect(restoredAsset).toBeDefined();
    expect([...new Uint8Array(await restoredAsset!.blob.arrayBuffer())]).toEqual([
      137, 80, 78, 71, 1, 2, 3,
    ]);
    expect(restoredAsset!.mimeType).toBe("image/webp");

    const settings = await settingsRepository.get();
    expect(settings.language).toBe("English");
    expect(settings.textModel).toBe("test/model-x");

    await wipeDatabaseForTest();
  });
});

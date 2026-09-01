import { describe, expect, test } from "bun:test";
import { zip, type Zippable } from "fflate";
import { gameRepository } from "../../db/gameRepository";
import { assetRepository } from "../../db/assetRepository";
import { buildExportBundle } from "../export/exportBundle";
import { NS_SAVE_FORMAT, NS_SAVE_VERSION } from "../export/types";
import { importSaveFromZipBytes } from "./importSave";
import {
  makeTestAsset,
  makeTestGame,
  makeTestNode,
  wipeDatabaseForTest,
} from "./testsupport/records";

async function buildNsSaveZipBytes(
  overrides: {
    manifest?: Record<string, unknown>;
    nodeMutations?: Record<string, string>;
  } = {},
): Promise<Uint8Array> {
  const game =
    overrides.manifest?.game === undefined
      ? makeTestGame("game-1", "インポートされるセーブ")
      : undefined;
  const node1 = makeTestNode("game-1", "game-1-node-1", 1);
  const node2 = makeTestNode("game-1", "game-1-node-2", 2);
  const bundle = buildExportBundle(
    game ?? (overrides.manifest!.game as Awaited<ReturnType<typeof makeTestGame>>),
    [node1, node2],
    [makeTestAsset("game-1-node-2", [4, 5, 6])],
    "2026-02-01T00:00:00.000Z",
  );
  const manifest = { ...bundle.manifest, ...(overrides.manifest ?? {}) };
  const files: Zippable = {
    "manifest.json": new TextEncoder().encode(JSON.stringify(manifest)),
  };
  for (const nodeFile of bundle.nodeFiles) {
    const mutated = overrides.nodeMutations?.[nodeFile.nodeId];
    files[nodeFile.path] = new TextEncoder().encode(mutated ?? nodeFile.json);
  }
  for (const assetFile of bundle.assetFiles) {
    files[assetFile.path] = [new Uint8Array(await assetFile.blob.arrayBuffer()), { level: 0 }];
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    zip(files, (error, archive) => (error ? reject(error) : resolve(archive)));
  });
}

describe("ns-save ZIP import (REDESIGN §5.5)", () => {
  test("imports the save, its nodes and mimeType-derived assets", async () => {
    const result = await importSaveFromZipBytes(await buildNsSaveZipBytes());
    expect(result.gameTitle).toBe("インポートされるセーブ");
    expect(result.restoredNodeCount).toBe(2);
    expect(result.restoredAssetCount).toBe(1);

    const game = await gameRepository.getGame("game-1");
    expect(game?.title).toBe("インポートされるセーブ");

    const asset = await assetRepository.get("game-1-node-2");
    expect(asset?.mimeType).toBe("image/webp");
    expect([...new Uint8Array(await asset!.blob.arrayBuffer())]).toEqual([4, 5, 6]);
    await wipeDatabaseForTest();
  });

  test("refuses archives from the future (non-destructive policy)", async () => {
    await expect(
      importSaveFromZipBytes(
        await buildNsSaveZipBytes({ manifest: { version: NS_SAVE_VERSION + 1 } }),
      ),
    ).rejects.toThrow(/Unsupported ns-save version/);
    await wipeDatabaseForTest();
  });

  test("refuses archives that are not ns-save", async () => {
    const { zip, strToU8 } = await import("fflate");
    const foreignZip = await new Promise<Uint8Array>((resolve, reject) => {
      zip({ "something.txt": strToU8("hello") }, (error, archive) =>
        error ? reject(error) : resolve(archive),
      );
    });
    await expect(importSaveFromZipBytes(foreignZip)).rejects.toThrow(/manifest.json missing/);
    await expect(importSaveFromZipBytes(new Uint8Array([1, 2, 3]))).rejects.toThrow(
      /not a readable ZIP/,
    );
    await wipeDatabaseForTest();
  });

  test("skips invalid and foreign nodes but imports the rest", async () => {
    const foreignNode = JSON.parse(
      JSON.stringify(makeTestNode("game-999", "foreign-node", 1)),
    ) as Record<string, unknown>;
    const result = await importSaveFromZipBytes(
      await buildNsSaveZipBytes({
        nodeMutations: {
          "game-1-node-2": JSON.stringify(foreignNode),
        },
      }),
    );
    expect(result.restoredNodeCount).toBe(1); // node-2 skipped (foreign game id)
    const nodeIds = (await gameRepository.getNodesOfGame("game-1")).map(
      (node) => node.id as string,
    );
    expect(nodeIds).toEqual(["game-1-node-1"]);
    expect(result.restoredAssetCount).toBe(0); // asset skipped with its node
    await wipeDatabaseForTest();
  });

  test("manifest format literal is ns-save", () => {
    expect(NS_SAVE_FORMAT).toBe("ns-save");
  });
});

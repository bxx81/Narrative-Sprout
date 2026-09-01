import { describe, expect, test } from "bun:test";
import { unzip, strFromU8 } from "fflate";
import {
  gameRecordSchema,
  storyNodeRecordSchema,
  gameIdSchema,
  storyNodeIdSchema,
} from "../../types";
import type { AssetRecord } from "../../types/asset";
import { buildExportBundle } from "./exportBundle";
import { createZipArchiveBlob } from "./zipArchive";
import { nsSaveManifestSchema, NS_SAVE_FORMAT, NS_SAVE_VERSION } from "./types";

function makeGame(overrides: Partial<Parameters<typeof gameRecordSchema.parse>[0]> = {}) {
  return gameRecordSchema.parse({
    id: gameIdSchema.parse("game-1"),
    schemaVersion: 1,
    title: "黄昏の王国",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastPlayedAt: "2026-01-02T00:00:00.000Z",
    latestNodeId: storyNodeIdSchema.parse("node-2"),
    attachmentTexts: ["王国の首都は…"],
    ...overrides,
  });
}

function makeNode(id: string, turnNumber: number, overrides: Record<string, unknown> = {}) {
  return storyNodeRecordSchema.parse({
    id: storyNodeIdSchema.parse(id),
    gameId: gameIdSchema.parse("game-1"),
    parentNodeId: turnNumber === 1 ? null : storyNodeIdSchema.parse("node-1"),
    turnNumber,
    choiceText: turnNumber === 1 ? null : "進む",
    scene: {
      reasoning: "r",
      sceneText: "本文",
      sceneWordCount: 2,
      imagePrompt: "p",
      negativeImagePrompt: "n",
      choices: ["a", "b"],
      isStoryOver: false,
      storyClosingText: "",
      locationContext: "城",
    },
    promptSent: "sent",
    memory: { notes: {}, storyLog: [] },
    memoryDelta: { notes: {}, sceneSummary: "s" },
    metadata: {
      generationCost: null,
      modelName: null,
      discardHistoryContext: false,
      refinePrompt: null,
      refinedFromNodeId: null,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

function makeAsset(nodeId: string, bytes: number[]): AssetRecord {
  return {
    nodeId: storyNodeIdSchema.parse(nodeId),
    blob: new Blob([new Uint8Array(bytes)], { type: "image/webp" }),
    mimeType: "image/webp",
    byteSize: bytes.length,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function unzipToMap(blob: Blob): Promise<Map<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    void blob.arrayBuffer().then((buffer) => {
      unzip(new Uint8Array(buffer), (error, data) => {
        if (error) reject(error);
        else resolve(new Map(Object.entries(data)));
      });
    });
  });
}

describe("buildExportBundle", () => {
  test("emits manifest, turn-ordered node files and mimeType-derived asset paths", () => {
    const bundle = buildExportBundle(
      makeGame(),
      [makeNode("node-2", 2), makeNode("node-1", 1)],
      [makeAsset("node-1", [1, 2, 3])],
      "2026-01-03T00:00:00.000Z",
    );

    expect(bundle.manifest).toEqual({
      format: NS_SAVE_FORMAT,
      version: NS_SAVE_VERSION,
      exportedAt: "2026-01-03T00:00:00.000Z",
      game: makeGame(),
    });
    expect(bundle.nodeFiles.map((f) => f.path)).toEqual(["nodes/node-1.json", "nodes/node-2.json"]);
    expect(bundle.assetFiles.map((f) => f.path)).toEqual(["assets/node-1.webp"]);
  });

  test("skips orphan assets (node missing) with a warning", () => {
    const bundle = buildExportBundle(
      makeGame(),
      [makeNode("node-1", 1)],
      [makeAsset("node-1", [1]), makeAsset("ghost-node", [2])],
    );
    expect(bundle.assetFiles.map((f) => f.nodeId)).toEqual(["node-1"]);
  });

  test("bundle contains exactly manifest + nodes + assets (no settings/credentials path)", () => {
    const bundle = buildExportBundle(
      makeGame(),
      [makeNode("node-1", 1)],
      [makeAsset("node-1", [1])],
    );
    const paths = [
      "manifest.json",
      ...bundle.nodeFiles.map((f) => f.path),
      ...bundle.assetFiles.map((f) => f.path),
    ];
    expect(paths.sort()).toEqual(["assets/node-1.webp", "manifest.json", "nodes/node-1.json"]);
  });
});

describe("createZipArchiveBlob", () => {
  test("produces a ZIP whose contents round-trip the bundle", async () => {
    const assetBytes = [137, 80, 78, 71];
    const bundle = buildExportBundle(
      makeGame(),
      [makeNode("node-1", 1), makeNode("node-2", 2)],
      [makeAsset("node-2", assetBytes)],
    );
    const zipBlob = await createZipArchiveBlob(bundle);
    expect(zipBlob.type).toBe("application/zip");

    const entries = await unzipToMap(zipBlob);
    expect([...entries.keys()].sort()).toEqual([
      "assets/node-2.webp",
      "manifest.json",
      "nodes/node-1.json",
      "nodes/node-2.json",
    ]);

    const manifest = nsSaveManifestSchema.parse(
      JSON.parse(strFromU8(entries.get("manifest.json")!)),
    );
    expect(manifest.game.title).toBe("黄昏の王国");

    const node1 = JSON.parse(strFromU8(entries.get("nodes/node-1.json")!));
    expect(node1.id).toBe("node-1");

    const storedAsset = entries.get("assets/node-2.webp")!;
    expect([...storedAsset]).toEqual(assetBytes);
  });
});

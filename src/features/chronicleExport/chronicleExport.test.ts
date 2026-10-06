import { describe, expect, test } from "bun:test";
import { strFromU8, unzip } from "fflate";
import {
  defaultSettingsRecord,
  gameIdSchema,
  gameRecordSchema,
  storyNodeIdSchema,
  storyNodeRecordSchema,
} from "../../types";
import type { AssetRecord } from "../../types/asset";
import { exportChronicleAsZip } from "./chronicleExport";

const translation = {
  chronicleTitle: "物語の記録",
  chronicleDescription: "説明",
  historyChoicePrefix: "選択",
};

function makeGame() {
  return gameRecordSchema.parse({
    id: gameIdSchema.parse("game-1"),
    schemaVersion: 1,
    title: "黄昏の王国",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastPlayedAt: "2026-01-02T00:00:00.000Z",
    latestNodeId: storyNodeIdSchema.parse("node-2"),
  });
}

function makeNode(
  id: string,
  turnNumber: number,
  sceneText: string,
  overrides: Record<string, unknown> = {},
) {
  return storyNodeRecordSchema.parse({
    id: storyNodeIdSchema.parse(id),
    gameId: gameIdSchema.parse("game-1"),
    parentNodeId: turnNumber === 1 ? null : storyNodeIdSchema.parse("node-1"),
    turnNumber,
    choiceText: turnNumber === 1 ? null : "進む",
    scene: {
      reasoning: "r",
      sceneText,
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

const settings = { ...defaultSettingsRecord, uiLanguage: "日本語", language: "Japanese" };

describe("exportChronicleAsZip", () => {
  test("archives index.html plus only the branch node images, root first", async () => {
    const result = await exportChronicleAsZip({
      game: makeGame(),
      nodes: [makeNode("node-1", 1, "FIRST_SCENE"), makeNode("node-2", 2, "SECOND_SCENE")],
      assets: { "node-1": makeAsset("node-1", [1, 2, 3]) },
      targetNodeId: "node-2",
      settings,
      translation,
    });

    expect(result.fileName.startsWith("ns-chronicle_")).toBe(true);
    expect(result.fileName.endsWith(".zip")).toBe(true);

    const entries = await unzipToMap(result.blob);
    expect([...entries.keys()].sort()).toEqual(["images/node-1.webp", "index.html"]);
    expect([...entries.get("images/node-1.webp")!]).toEqual([1, 2, 3]);

    const html = strFromU8(entries.get("index.html")!);
    expect(html.indexOf("FIRST_SCENE")).toBeLessThan(html.indexOf("SECOND_SCENE"));
    expect(html).toContain("text-[18px]");
  });

  test("excludes nodes outside the target branch", async () => {
    const result = await exportChronicleAsZip({
      game: makeGame(),
      nodes: [
        makeNode("node-1", 1, "ROOT"),
        makeNode("node-2", 2, "ON_BRANCH"),
        makeNode("node-3", 2, "OTHER_BRANCH"),
      ],
      assets: {
        "node-1": makeAsset("node-1", [1]),
        "node-2": makeAsset("node-2", [2]),
        "node-3": makeAsset("node-3", [3]),
      },
      targetNodeId: "node-2",
      settings,
      translation,
    });

    const entries = await unzipToMap(result.blob);
    expect([...entries.keys()].sort()).toEqual([
      "images/node-1.webp",
      "images/node-2.webp",
      "index.html",
    ]);
    const html = strFromU8(entries.get("index.html")!);
    expect(html).toContain("ON_BRANCH");
    expect(html).not.toContain("OTHER_BRANCH");
  });

  test("the archive carries no settings/credentials (only html + images)", async () => {
    const result = await exportChronicleAsZip({
      game: makeGame(),
      nodes: [makeNode("node-1", 1, "ROOT")],
      assets: { "node-1": makeAsset("node-1", [9]) },
      targetNodeId: "node-1",
      settings,
      translation,
    });
    const entries = await unzipToMap(result.blob);
    expect(
      [...entries.keys()].every((key) => key === "index.html" || key.startsWith("images/")),
    ).toBe(true);
  });
});

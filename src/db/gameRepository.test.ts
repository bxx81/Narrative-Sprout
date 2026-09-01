import { beforeEach, describe, expect, test } from "bun:test";
import { db } from "./database";
import { gameRepository } from "./gameRepository";
import { wipeRepository } from "./wipeRepository";
import { assetRepository } from "./assetRepository";
import { gameIdSchema, storyNodeIdSchema, type GameRecord, type StoryNodeRecord } from "../types";
import type { AssetRecord } from "../types/asset";

/**
 * Persistence round-trip tests (Phase 4 completion criterion: "永続化一周のE2E").
 * These run on fake-indexeddb, registered via the bunfig.toml preload.
 */

function makeGame(id: string, lastPlayedAt: string): GameRecord {
  return {
    id: gameIdSchema.parse(id),
    schemaVersion: 1,
    title: `Game ${id}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastPlayedAt,
    latestNodeId: null,
    attachmentTexts: undefined,
  };
}

function makeNode(id: string, gameId: string, turnNumber: number): StoryNodeRecord {
  return {
    id: storyNodeIdSchema.parse(id),
    gameId: gameIdSchema.parse(gameId),
    parentNodeId: turnNumber === 1 ? null : storyNodeIdSchema.parse("root"),
    turnNumber,
    choiceText: turnNumber === 1 ? null : "進む",
    scene: {
      reasoning: "r",
      sceneText: "本文",
      sceneWordCount: 2,
      imagePrompt: "p",
      negativeImagePrompt: "n",
      choices: ["a"],
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
  };
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

beforeEach(async () => {
  // db.transaction() does not auto-reopen a closed connection, so reopen
  // explicitly after wiping.
  await db.delete();
  await db.open();
});

describe("gameRepository persistence cycle", () => {
  test("createGame persists game, root node and asset transactionally", async () => {
    const game = makeGame("game-a", "2026-01-01T00:00:00.000Z");
    const root = makeNode("root", "game-a", 1);
    await gameRepository.createGame(game, root, makeAsset("root", [1, 2, 3]));

    expect(await gameRepository.getGame("game-a")).toMatchObject({ id: "game-a" });
    expect((await gameRepository.getNode("root"))?.turnNumber).toBe(1);
    expect((await assetRepository.get("root"))?.byteSize).toBe(3);
  });

  test("appendNode adds the node and stores the updated header", async () => {
    const game = makeGame("game-a", "2026-01-01T00:00:00.000Z");
    const root = makeNode("root", "game-a", 1);
    await gameRepository.createGame(game, root, null);

    const turn2 = makeNode("n2", "game-a", 2);
    const updated: GameRecord = {
      ...game,
      latestNodeId: turn2.id,
      lastPlayedAt: turn2.createdAt,
    };
    await gameRepository.appendNode(turn2, updated, makeAsset("n2", [9]));

    const nodes = await gameRepository.getNodesOfGame("game-a");
    expect(nodes.map((n) => n.id as string)).toEqual(["root", "n2"]);
    expect((await gameRepository.getGame("game-a"))?.latestNodeId as string | null).toBe("n2");
    expect((await assetRepository.get("n2"))?.byteSize).toBe(1);
  });

  test("listGames sorts saves newest-first by lastPlayedAt", async () => {
    await gameRepository.createGame(
      makeGame("old", "2026-01-01T00:00:00.000Z"),
      makeNode("n-old", "old", 1),
      null,
    );
    await gameRepository.createGame(
      makeGame("new", "2026-02-01T00:00:00.000Z"),
      makeNode("n-new", "new", 1),
      null,
    );
    await gameRepository.createGame(
      makeGame("mid", "2026-01-15T00:00:00.000Z"),
      makeNode("n-mid", "mid", 1),
      null,
    );

    const ids = (await gameRepository.listGames()).map((g) => g.id as string);
    expect(ids).toEqual(["new", "mid", "old"]);
  });

  test("deleteGame removes the game, all nodes and all assets", async () => {
    const game = makeGame("game-a", "2026-01-01T00:00:00.000Z");
    await gameRepository.createGame(game, makeNode("root", "game-a", 1), makeAsset("root", [1]));
    await gameRepository.appendNode(makeNode("n2", "game-a", 2), game, makeAsset("n2", [2]));

    await gameRepository.deleteGame("game-a");

    expect(await gameRepository.getGame("game-a")).toBeUndefined();
    expect((await gameRepository.getNodesOfGame("game-a")).length).toBe(0);
    expect(await assetRepository.get("root")).toBeUndefined();
    expect(await assetRepository.get("n2")).toBeUndefined();
  });

  test("deleteBranch removes the entire game when the last node disappears", async () => {
    const game = makeGame("game-a", "2026-01-01T00:00:00.000Z");
    await gameRepository.createGame(game, makeNode("root", "game-a", 1), makeAsset("root", [1]));

    const result = await gameRepository.deleteBranch("game-a", "root");

    expect(result).toBeNull();
    expect(await gameRepository.getGame("game-a")).toBeUndefined();
    expect(await assetRepository.get("root")).toBeUndefined();
  });
});

describe("wipeRepository", () => {
  test("wipeAllUserData empties every store, including settings and credentials", async () => {
    await gameRepository.createGame(
      makeGame("game-a", "2026-01-01T00:00:00.000Z"),
      makeNode("root", "game-a", 1),
      makeAsset("root", [1]),
    );
    await db.settings.put({
      key: "app",
      language: "Japanese",
      sceneTextLength: "medium",
      textModel: "openai/gpt-4o-mini",
      imageGenerator: "disabled",
      a1111Endpoint: "http://127.0.0.1:7860",
      a1111Config: "{}",
      comfyuiEndpoint: "http://127.0.0.1:8188",
      comfyuiWorkflow: "{}",
      huggingFaceSpaceId: "space",
      huggingFaceConfig: "{}",
      nimEndpoint: "https://example.invalid",
      nimConfig: "{}",
      webpCompression: "normal",
      memoryStrategy: "single",
      enableStoryLogCompaction: true,
    });
    await db.credentials.put({ key: "openrouterApiKey", value: "sk-or-test" });

    await wipeRepository.wipeAllUserData();
    await db.open(); // wipe closed the connection; reopen for verification

    expect((await db.games.count()) + (await db.nodes.count()) + (await db.assets.count())).toBe(0);
    expect(await db.settings.count()).toBe(0);
    expect(await db.credentials.count()).toBe(0);

    // The database remains usable afterwards (auto-recreated on next use).
    await gameRepository.createGame(
      makeGame("game-b", "2026-01-01T00:00:00.000Z"),
      makeNode("root-b", "game-b", 1),
      null,
    );
    expect(await gameRepository.getGame("game-b")).toMatchObject({ id: "game-b" });
  });
});

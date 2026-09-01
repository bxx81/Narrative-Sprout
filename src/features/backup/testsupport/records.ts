import {
  gameRecordSchema,
  storyNodeRecordSchema,
  gameIdSchema,
  storyNodeIdSchema,
} from "../../../types";
import { settingsRecordSchema, type SettingsRecord } from "../../../types/settings";
import type { AssetRecord } from "../../../types/asset";
import type { GameRecord, StoryNodeRecord } from "../../../types";

/**
 * Record factories shared by backup/import tests. Parsed through the real
 * Zod schemas so branded ids and defaults behave exactly like production data.
 */

export function makeTestGame(
  gameId: string,
  title: string,
  overrides: Record<string, unknown> = {},
): GameRecord {
  return gameRecordSchema.parse({
    id: gameIdSchema.parse(gameId),
    schemaVersion: 1,
    title,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastPlayedAt: "2026-01-02T00:00:00.000Z",
    latestNodeId: storyNodeIdSchema.parse(`${gameId}-node-1`),
    attachmentTexts: [`${title} の世界設定`],
    ...overrides,
  });
}

export function makeTestNode(
  gameId: string,
  nodeId: string,
  turnNumber: number,
  overrides: Record<string, unknown> = {},
): StoryNodeRecord {
  return storyNodeRecordSchema.parse({
    id: storyNodeIdSchema.parse(nodeId),
    gameId: gameIdSchema.parse(gameId),
    parentNodeId:
      turnNumber === 1 ? null : storyNodeIdSchema.parse(`${gameId}-node-${turnNumber - 1}`),
    turnNumber,
    choiceText: turnNumber === 1 ? null : "進む",
    scene: {
      reasoning: "root",
      sceneText: `${nodeId} の本文`,
      sceneWordCount: 6,
      imagePrompt: "a castle at dusk",
      negativeImagePrompt: "low quality",
      choices: ["a", "b"],
      isStoryOver: false,
      storyClosingText: "",
      locationContext: "城",
    },
    promptSent: `${nodeId} への指示文`,
    memory: { notes: { [nodeId]: `${nodeId} のメモ` }, storyLog: [`${nodeId} のあらすじ`] },
    memoryDelta: { notes: {}, sceneSummary: `${nodeId} の要約` },
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

export function makeTestAsset(nodeId: string, bytes: number[]): AssetRecord {
  return {
    nodeId: storyNodeIdSchema.parse(nodeId),
    blob: new Blob([new Uint8Array(bytes)], { type: "image/webp" }),
    mimeType: "image/webp",
    byteSize: bytes.length,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

export function makeTestSettings(overrides: Record<string, unknown> = {}): SettingsRecord {
  return settingsRecordSchema.parse({
    key: "app",
    language: "English",
    sceneTextLength: "long",
    textModel: "test/model-x",
    ...overrides,
  });
}

/** Deletes everything and reopens the DB (transactions need an explicit open). */
export async function wipeDatabaseForTest(): Promise<void> {
  const { db } = await import("../../../db/database");
  await db.delete();
  await db.open();
}

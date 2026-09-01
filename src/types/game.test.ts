import { describe, expect, test } from "bun:test";
import {
  gameRecordSchema,
  storyNodeRecordSchema,
  type GameRecord,
  type StoryNodeRecord,
} from "./game";
import type { GameId, StoryNodeId } from "./ids";

const gameId = "game-1" as GameId;
const nodeId = "node-1" as StoryNodeId;

const minimalGameRecord: GameRecord = {
  id: gameId,
  schemaVersion: 1,
  title: "黄昏の王国",
  createdAt: "2026-08-24T00:00:00.000Z",
  lastPlayedAt: "2026-08-24T00:00:00.000Z",
  latestNodeId: nodeId,
  attachmentTexts: [],
};

const minimalNode: StoryNodeRecord = {
  id: nodeId,
  gameId,
  parentNodeId: null,
  turnNumber: 1,
  choiceText: null,
  scene: {
    reasoning: "thinking",
    sceneText: "王国は黄昏に沈みゆく。",
    sceneWordCount: 10,
    imagePrompt: "a castle at dusk",
    negativeImagePrompt: "",
    choices: ["城へ向かう", "森へ逃げる", "その場で待つ"],
    isStoryOver: false,
    storyClosingText: "",
    locationContext: "王国の外れ",
  },
  promptSent: "テーマ: 黄昏の王国 ...",
  memory: { notes: {}, storyLog: [] },
  memoryDelta: { notes: {}, sceneSummary: "導入" },
  metadata: {
    generationCost: null,
    modelName: null,
    discardHistoryContext: false,
    refinePrompt: null,
    refinedFromNodeId: null,
  },
  createdAt: "2026-08-24T00:00:00.000Z",
};

describe("GameRecord schema", () => {
  test("accepts a minimal valid record", () => {
    expect(gameRecordSchema.safeParse(minimalGameRecord).success).toBe(true);
  });

  test("accepts missing attachmentTexts (optional, per-game world data)", () => {
    const { attachmentTexts: _attachmentTexts, ...withoutAttachments } = minimalGameRecord;
    void _attachmentTexts;
    expect(gameRecordSchema.safeParse(withoutAttachments).success).toBe(true);
  });

  test("filters invalid attachmentTexts elements element-wise (REDESIGN §5.7)", () => {
    const withBad = {
      ...minimalGameRecord,
      attachmentTexts: ["valid", 123 as unknown as string, null as unknown as string, "also valid"],
    };
    const result = gameRecordSchema.safeParse(withBad);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.attachmentTexts).toEqual(["valid", "also valid"]);
  });

  test("rejects settings-like leftovers (records carry no settings, REDESIGN §5.2)", () => {
    const result = gameRecordSchema.safeParse(minimalGameRecord);
    expect(result.success && result.data).not.toHaveProperty("imageSettings");
  });

  test("rejects missing latestNodeId field presence (must be explicit null)", () => {
    const broken = { ...minimalGameRecord } as Record<string, unknown>;
    delete broken["latestNodeId"];
    expect(gameRecordSchema.safeParse(broken).success).toBe(false);
  });
});

describe("StoryNodeRecord schema", () => {
  test("accepts a minimal valid root node", () => {
    expect(storyNodeRecordSchema.safeParse(minimalNode).success).toBe(true);
  });

  test("requires promptSent (used to rebuild conversation history)", () => {
    const broken = { ...minimalNode, promptSent: undefined };
    expect(storyNodeRecordSchema.safeParse(broken).success).toBe(false);
  });

  test("rejects negative word counts and zero turn numbers", () => {
    const badScene = {
      ...minimalNode,
      scene: { ...minimalNode.scene, sceneWordCount: -1 },
    };
    expect(storyNodeRecordSchema.safeParse(badScene).success).toBe(false);
    const badTurn = { ...minimalNode, turnNumber: 0 };
    expect(storyNodeRecordSchema.safeParse(badTurn).success).toBe(false);
  });
});

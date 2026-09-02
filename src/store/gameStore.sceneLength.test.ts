import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { db } from "../db/database";
import { useGameStore } from "./gameStore";
import { defaultSettingsRecord } from "../types";
import type { GameRecord, StoryNodeRecord } from "../types";

/**
 * Per-save scene length snapshot (legacy behavior): a save created with one
 * length order keeps generating with it even if the global setting changed.
 * Old saves without the field fall back to the current global setting.
 */

const narratorContent = JSON.stringify({
  sceneText: "The story continues.",
  locationContext: null,
  imagePrompt: "a hallway",
  negativeImagePrompt: null,
  choice1: "left",
  choice2: "right",
  choice3: "wait",
  isStoryOver: false,
  finalEndingPassage: "",
  sceneSummary: "a turn",
  notes: {},
});

const realFetch = globalThis.fetch;
let capturedPrompts: string[];

function stubFetchCapturingSystem(): void {
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      messages: { role: string; content: string }[];
    };
    // The length instruction lives in the user message ("Target scene
    // length: …"), so capture the whole conversation for the assertions.
    capturedPrompts.push(body.messages.map((m) => m.content).join("\n"));
    return new Response(
      JSON.stringify({
        model: "test-model",
        choices: [{ message: { content: narratorContent }, finish_reason: "stop" }],
        usage: { cost: 0.01 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
}

function makeNode(
  parentNodeId: string | null,
  turnNumber: number,
  choiceText: string | null,
): StoryNodeRecord {
  return {
    id: `node-${turnNumber}` as StoryNodeRecord["id"],
    gameId: "game-1" as StoryNodeRecord["gameId"],
    parentNodeId: (parentNodeId as StoryNodeRecord["parentNodeId"]) ?? null,
    turnNumber,
    choiceText,
    scene: {
      reasoning: "",
      sceneText: "scene text",
      sceneWordCount: 2,
      imagePrompt: "img",
      negativeImagePrompt: "",
      choices: ["a", "b", "c"],
      isStoryOver: false,
      storyClosingText: "",
      locationContext: "",
    },
    promptSent: "p",
    memory: { notes: {}, storyLog: [] },
    memoryDelta: { notes: {}, sceneSummary: "s" },
    metadata: {
      generationCost: null,
      modelName: null,
      discardHistoryContext: false,
      refinePrompt: null,
      refinedFromNodeId: null,
      autoplayReasoning: null,
    },
    createdAt: new Date(2026, 0, turnNumber).toISOString(),
  };
}

function makeGame(sceneTextLength?: string): GameRecord {
  const base = {
    id: "game-1" as GameRecord["id"],
    schemaVersion: 1,
    title: "Theme",
    createdAt: new Date(2026, 0, 1).toISOString(),
    lastPlayedAt: new Date(2026, 0, 1).toISOString(),
    latestNodeId: null,
    attachmentTexts: [],
  };
  return (sceneTextLength ? { ...base, sceneTextLength } : base) as GameRecord;
}

describe("per-save sceneTextLength snapshot", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    capturedPrompts = [];
    stubFetchCapturingSystem();
    useGameStore.setState({
      settings: { ...defaultSettingsRecord, enableStreaming: false, imageGenerator: "disabled" },
      openrouterApiKey: "sk-or-test",
      activeGame: null,
      nodes: [],
      viewingNodeId: null,
      currentNodeId: null,
      generation: { phase: "idle" },
      generationStage: null,
      imageGenerationProgress: null,
    });
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("choose uses the save's snapshot even when the global setting differs", async () => {
    const game = makeGame("novel2"); // created as 800-1600 words
    const root = makeNode(null, 1, null);
    await db.games.put(game);
    await db.nodes.put(root);
    useGameStore.setState({
      // The user later changed the global setting to medium…
      settings: {
        ...useGameStore.getState().settings!,
        sceneTextLength: "medium",
        imageGenerator: "disabled",
        enableStreaming: false,
      },
      activeGame: game,
      nodes: [root],
      viewingNodeId: root.id,
      currentNodeId: root.id,
    });

    await useGameStore.getState().choose("open the door");

    expect(useGameStore.getState().generation.phase).toBe("idle");
    expect(capturedPrompts.length).toBeGreaterThan(0);
    expect(capturedPrompts[0]).toContain("800 and 1600");
  });

  test("old saves without the snapshot fall back to the global setting", async () => {
    const game = makeGame(); // pre-snapshot save: no sceneTextLength field
    const root = makeNode(null, 1, null);
    await db.games.put(game);
    await db.nodes.put(root);
    useGameStore.setState({
      settings: {
        ...useGameStore.getState().settings!,
        sceneTextLength: "medium",
        imageGenerator: "disabled",
        enableStreaming: false,
      },
      activeGame: game,
      nodes: [root],
      viewingNodeId: root.id,
      currentNodeId: root.id,
    });

    await useGameStore.getState().choose("open the door");

    expect(capturedPrompts.length).toBeGreaterThan(0);
    expect(capturedPrompts[0]).toContain("100 and 200");
  });

  test("startNewGame snapshots the current global setting into the save", async () => {
    await useGameStore.getState().startNewGame("A lighthouse at the end of time");
    expect(useGameStore.getState().generation.phase).toBe("idle");
    const activeGame = useGameStore.getState().activeGame!;
    expect(activeGame.sceneTextLength).toBe(useGameStore.getState().settings!.sceneTextLength);
  });
});

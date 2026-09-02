import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { db } from "../db/database";
import { useGameStore } from "./gameStore";
import { defaultSettingsRecord } from "../types";
import type { GameRecord, StoryNodeRecord } from "../types";

/**
 * Loading overlay stage tracking (legacy state.spinnerState): the stage must
 * follow the generation pipeline (choice → scene → image) instead of staying
 * on the payload kind for the whole run.
 */

const narratorContent = JSON.stringify({
  sceneText: "The story continues here.",
  locationContext: null,
  imagePrompt: "a hallway",
  negativeImagePrompt: null,
  choice1: "go left",
  choice2: "go right",
  choice3: "wait",
  isStoryOver: false,
  finalEndingPassage: "",
  sceneSummary: "a turn",
  notes: {},
});

const realFetch = globalThis.fetch;

let observedStages: (string | null)[];
let resolveNarration: (() => void) | null = null;

function stubFetchHoldingNarration(): void {
  globalThis.fetch = (async () => {
    observedStages.push(useGameStore.getState().generationStage);
    await new Promise<void>((resolve) => {
      resolveNarration = resolve;
    });
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
    id: `node-${turnNumber}-${choiceText ?? "root"}` as StoryNodeRecord["id"],
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

function makeGame(): GameRecord {
  return {
    id: "game-1" as GameRecord["id"],
    schemaVersion: 1,
    title: "Theme",
    createdAt: new Date(2026, 0, 1).toISOString(),
    lastPlayedAt: new Date(2026, 0, 1).toISOString(),
    latestNodeId: null,
    attachmentTexts: [],
  };
}

describe("gameStore generationStage (loading overlay)", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    observedStages = [];
    stubFetchHoldingNarration();
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

  test("choose runs as stage 'choice' and switches to 'scene' when the text call starts", async () => {
    const game = makeGame();
    const root = makeNode(null, 1, null);
    await db.games.put(game);
    await db.nodes.put(root);
    useGameStore.setState({
      activeGame: game,
      nodes: [root],
      viewingNodeId: root.id,
      currentNodeId: root.id,
    });

    const running = useGameStore.getState().choose("open the door");
    // The store marks the stage as soon as the operation starts…
    expect(useGameStore.getState().generationStage).toBe("choice");
    // …then switches to "scene" when the narration call starts. The fetch
    // stub observes the stage at call time (the pipeline is async, so wait
    // for the stub to register before releasing it).
    for (let i = 0; i < 50 && !resolveNarration; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    resolveNarration?.();
    await running;

    expect(observedStages).toEqual(["scene"]);
    expect(useGameStore.getState().generation.phase).toBe("idle");
  });
});

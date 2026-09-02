import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { db } from "../db/database";
import { useGameStore } from "./gameStore";
import { defaultSettingsRecord } from "../types";
import type { GameRecord, StoryNodeRecord } from "../types";

/**
 * Redo flows (legacy redoScene): non-root redo re-rolls the same choice as a
 * sibling under the same parent (optionally discarding prompt history);
 * root redo creates a NEW save slot while the current save remains.
 */

const narratorContent = JSON.stringify({
  sceneText: "A fresh re-roll of the scene.",
  locationContext: null,
  imagePrompt: "same street",
  negativeImagePrompt: null,
  choice1: "go left",
  choice2: "go right",
  choice3: "wait",
  isStoryOver: false,
  finalEndingPassage: "",
  sceneSummary: "a re-rolled scene",
  notes: {},
});

const realFetch = globalThis.fetch;

function stubNarratorFetch(): void {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        model: "test-model",
        choices: [{ message: { content: narratorContent }, finish_reason: "stop" }],
        usage: { cost: 0.01 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as unknown as typeof fetch;
}

let seq = 0;
function makeNode(
  parentNodeId: string | null,
  turnNumber: number,
  choiceText: string | null,
): StoryNodeRecord {
  seq += 1;
  return {
    id: `node-${seq}` as StoryNodeRecord["id"],
    gameId: "game-1" as StoryNodeRecord["gameId"],
    parentNodeId: (parentNodeId as StoryNodeRecord["parentNodeId"]) ?? null,
    turnNumber,
    choiceText,
    scene: {
      reasoning: "",
      sceneText: `scene ${seq}`,
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
    createdAt: new Date(2026, 0, seq).toISOString(),
  };
}

function makeGame(): GameRecord {
  return {
    id: "game-1" as GameRecord["id"],
    schemaVersion: 1,
    title: "The original theme",
    createdAt: new Date(2026, 0, 1).toISOString(),
    lastPlayedAt: new Date(2026, 0, 1).toISOString(),
    latestNodeId: null,
    attachmentTexts: [],
  };
}

describe("gameStore redoScene", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    stubNarratorFetch();
    useGameStore.setState({
      settings: { ...defaultSettingsRecord, enableStreaming: false },
      openrouterApiKey: "sk-or-test",
      activeGame: null,
      nodes: [],
      viewingNodeId: null,
      currentNodeId: null,
      generation: { phase: "idle" },
    });
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("non-root redo creates a sibling with the same choice under the same parent", async () => {
    const game = makeGame();
    const root = makeNode(null, 1, null);
    const child = makeNode(root.id, 2, "open the door");
    await db.games.put(game);
    await db.nodes.bulkPut([root, child]);
    useGameStore.setState({
      activeGame: game,
      nodes: [root, child],
      viewingNodeId: child.id,
      currentNodeId: child.id,
    });

    await useGameStore.getState().redoScene(child.id, false);

    const s = useGameStore.getState();
    expect(s.generation.phase).toBe("idle");
    const newNode = s.nodes.find(
      (n) => !["root-node"].includes(n.id) && n.id !== root.id && n.id !== child.id,
    );
    expect(newNode).toBeDefined();
    expect(newNode!.parentNodeId).toBe(root.id);
    expect(newNode!.choiceText).toBe("open the door");
    expect(newNode!.metadata.discardHistoryContext).toBe(false);
    expect(s.viewingNodeId).toBe(newNode!.id);
  });

  test("non-root redo with discard flags the produced node", async () => {
    const game = makeGame();
    const root = makeNode(null, 1, null);
    const child = makeNode(root.id, 2, "open the door");
    await db.games.put(game);
    await db.nodes.bulkPut([root, child]);
    useGameStore.setState({
      activeGame: game,
      nodes: [root, child],
      viewingNodeId: child.id,
      currentNodeId: child.id,
    });

    await useGameStore.getState().redoScene(child.id, true);

    const s = useGameStore.getState();
    const newNode = s.nodes.find((n) => n.id !== root.id && n.id !== child.id);
    expect(newNode).toBeDefined();
    expect(newNode!.metadata.discardHistoryContext).toBe(true);
    const stored = await db.nodes.get(newNode!.id);
    expect(stored?.metadata.discardHistoryContext).toBe(true);
  });

  test("root redo creates a new save slot and keeps the current save", async () => {
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

    await useGameStore.getState().redoScene(root.id, false);

    const s = useGameStore.getState();
    expect(s.generation.phase).toBe("idle");
    // A new game became active with a new root; the old save still exists.
    expect(s.activeGame!.id).not.toBe(game.id);
    expect(s.activeGame!.title).toBe(game.title);
    expect(s.activeGame!.attachmentTexts).toEqual(game.attachmentTexts);
    expect(s.nodes).toHaveLength(1);
    expect(s.nodes[0]!.parentNodeId).toBe(null);
    expect(s.nodes[0]!.id).not.toBe(root.id);
    const games = await db.games.toArray();
    expect(games).toHaveLength(2);
    expect(games.some((g) => g.id === game.id)).toBe(true);
  });
});

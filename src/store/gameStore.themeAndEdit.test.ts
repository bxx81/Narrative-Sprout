import { describe, test, expect, beforeEach } from "bun:test";
import { db } from "../db/database";
import { useGameStore } from "./gameStore";
import { defaultSettingsRecord } from "../types";
import type { GameRecord, StoryNodeRecord } from "../types";

// Generate Idea flow: stocked ideas pop without network; generation is
// driven through the same store actions the screen calls.

let seq = 0;
function makeNode(parentNodeId: string | null, turnNumber: number): StoryNodeRecord {
  seq += 1;
  return {
    id: `node-${seq}` as StoryNodeRecord["id"],
    gameId: "game-1" as StoryNodeRecord["gameId"],
    parentNodeId: (parentNodeId as StoryNodeRecord["parentNodeId"]) ?? null,
    turnNumber,
    choiceText: null,
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
    title: "t",
    createdAt: new Date(2026, 0, 1).toISOString(),
    lastPlayedAt: new Date(2026, 0, 1).toISOString(),
    latestNodeId: null,
    attachmentTexts: [],
  };
}

describe("gameStore cycleTheme (Generate Idea)", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    useGameStore.setState({
      activeGame: null,
      nodes: [],
      generatedThemes: [],
      themeGeneration: { phase: "idle" },
    });
  });

  test("pops stocked ideas before generating", async () => {
    useGameStore.setState({ generatedThemes: ["Idea A", "Idea B"] });
    const first = await useGameStore.getState().cycleTheme();
    expect(first).toBe("Idea A");
    expect(useGameStore.getState().generatedThemes).toEqual(["Idea B"]);
    const second = await useGameStore.getState().cycleTheme();
    expect(second).toBe("Idea B");
    expect(useGameStore.getState().generatedThemes).toEqual([]);
  });

  test("generation failure records the phase and rethrows for the caller", async () => {
    useGameStore.setState({
      settings: { ...defaultSettingsRecord, textModel: "" }, // invalid → fails fast
      openrouterApiKey: "sk-or-test",
      language: undefined,
    } as never);
    let threw = false;
    try {
      await useGameStore.getState().cycleTheme();
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(useGameStore.getState().themeGeneration.phase).toBe("failed");
  });
});

describe("gameStore updateSceneText (manual editing)", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    const game = makeGame();
    const root = makeNode(null, 1);
    await db.games.put(game);
    await db.nodes.put(root);
    useGameStore.setState({
      activeGame: game,
      nodes: [root],
      viewingNodeId: root.id,
      currentNodeId: root.id,
    });
  });

  test("rewrites the stored node in place and refreshes the word count", async () => {
    const root = useGameStore.getState().nodes[0]!;
    await useGameStore.getState().updateSceneText(root.id, "The knight rises.\nAt dawn.");

    const node = useGameStore.getState().nodes[0]!;
    expect(node.scene.sceneText).toBe("The knight rises.\nAt dawn.");
    expect(node.scene.sceneWordCount).toBeGreaterThan(0);
    expect(node.id).toBe(root.id); // same node: no new branch
    const stored = await db.nodes.get(root.id);
    expect(stored?.scene.sceneText).toBe("The knight rises.\nAt dawn.");
  });
});

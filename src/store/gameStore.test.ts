import { describe, test, expect, beforeEach } from "bun:test";
import { db } from "../db/database";
import { useGameStore } from "./gameStore";
import type { GameRecord, StoryNodeRecord } from "../types";

// Minimal record factories for navigation-flow tests (store-level; the UI
// hook `useGameNavigation` derives its flags from exactly this state).
let seq = 0;
function makeNode(
  gameId: string,
  parentNodeId: string | null,
  turnNumber: number,
): StoryNodeRecord {
  seq += 1;
  return {
    id: `node-${seq}` as StoryNodeRecord["id"],
    gameId: gameId as StoryNodeRecord["gameId"],
    parentNodeId: (parentNodeId as StoryNodeRecord["parentNodeId"]) ?? null,
    turnNumber,
    choiceText: parentNodeId ? `choice ${seq}` : null,
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
    },
    createdAt: new Date(2026, 0, seq).toISOString(),
  };
}

function makeGame(latestNodeId: string): GameRecord {
  return {
    id: "game-1" as GameRecord["id"],
    schemaVersion: 1,
    title: "t",
    createdAt: new Date(2026, 0, 1).toISOString(),
    lastPlayedAt: new Date(2026, 0, 1).toISOString(),
    latestNodeId: (latestNodeId as GameRecord["latestNodeId"]) ?? null,
    attachmentTexts: [],
  };
}

async function seedBranchingTree() {
  // R -> M -> { L1, L2 } : two sibling branches under M, save points at L1.
  const game = makeGame("L1");
  const root = makeNode(game.id, null, 1);
  const mid = makeNode(game.id, root.id, 2);
  const leaf1 = makeNode(game.id, mid.id, 3);
  const leaf2 = makeNode(game.id, mid.id, 3);
  // Rename to stable ids for assertions.
  const byRole = { root, mid, leaf1, leaf2 };
  game.latestNodeId = leaf1.id;
  await db.games.put(game);
  await db.nodes.bulkPut([root, mid, leaf1, leaf2]);
  return { game, byRole };
}

describe("gameStore scene navigation (playhead)", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    useGameStore.setState({
      activeGame: null,
      nodes: [],
      viewingNodeId: null,
      currentNodeId: null,
    });
  });

  test("openGame points viewing and playhead at the save's latest node", async () => {
    const { game, byRole } = await seedBranchingTree();
    await useGameStore.getState().openGame(game.id);
    const s = useGameStore.getState();
    expect(s.viewingNodeId).toBe(byRole.leaf1.id);
    expect(s.currentNodeId).toBe(byRole.leaf1.id);
  });

  test("resumeStoryAtNode moves viewing and the playhead to the resumed leaf", async () => {
    const { game, byRole } = await seedBranchingTree();
    await useGameStore.getState().openGame(game.id);
    useGameStore.getState().resumeStoryAtNode(byRole.leaf2.id, byRole.leaf2.id);
    const s = useGameStore.getState();
    expect(s.viewingNodeId).toBe(byRole.leaf2.id);
    expect(s.currentNodeId).toBe(byRole.leaf2.id);
  });

  test("resumeStoryAtNode accepts a mid-branch viewing node with a branch end playhead", async () => {
    const { game, byRole } = await seedBranchingTree();
    await useGameStore.getState().openGame(game.id);
    useGameStore.getState().resumeStoryAtNode(byRole.mid.id, byRole.leaf2.id);
    const s = useGameStore.getState();
    expect(s.viewingNodeId).toBe(byRole.mid.id);
    expect(s.currentNodeId).toBe(byRole.leaf2.id);
  });

  test("resumeStoryAtNode ignores unknown node ids", async () => {
    const { game, byRole } = await seedBranchingTree();
    await useGameStore.getState().openGame(game.id);
    useGameStore.getState().resumeStoryAtNode("unknown", "unknown");
    const s = useGameStore.getState();
    expect(s.viewingNodeId).toBe(byRole.leaf1.id);
    expect(s.currentNodeId).toBe(byRole.leaf1.id);
  });
});

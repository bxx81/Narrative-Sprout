import type { Page } from "@playwright/test";
import type { GameRecord, StoryNodeRecord } from "../../src/types/game";
import type { GameId, StoryNodeId } from "../../src/types/ids";

/**
 * E2E seed helper: writes a game with a root node plus leaf branches
 * directly into IndexedDB, then reloads so `bootstrap()` picks it up.
 *
 * Seeding bypasses story generation (no LLM, no network): records are
 * hand-built to satisfy what Load/History screens render. Repository
 * reads are unvalidated, so only UI-visible fields need care.
 */
export interface SeedLeaf {
  nodeId: string;
  choiceText: string;
  sceneText: string;
}

function buildScene(sceneText: string): StoryNodeRecord["scene"] {
  return {
    reasoning: "",
    sceneText,
    sceneWordCount: sceneText.split(" ").length,
    imagePrompt: "seeded illustration",
    negativeImagePrompt: "",
    choices: ["Go left", "Go right"],
    isStoryOver: false,
    storyClosingText: "",
    locationContext: "seeded lighthouse",
  };
}

function buildNode(
  nodeId: StoryNodeId,
  gameId: GameId,
  parentNodeId: StoryNodeId | null,
  turnNumber: number,
  choiceText: string | null,
  sceneText: string,
  createdAt: string,
): StoryNodeRecord {
  return {
    id: nodeId,
    gameId,
    parentNodeId,
    turnNumber,
    choiceText,
    scene: buildScene(sceneText),
    promptSent: "seeded prompt",
    memory: { notes: {}, storyLog: [] },
    memoryDelta: { notes: {}, sceneSummary: "seeded turn" },
    metadata: {
      generationCost: null,
      modelName: null,
      discardHistoryContext: false,
      refinePrompt: null,
      refinedFromNodeId: null,
    },
    createdAt,
  };
}

export async function seedGame(
  page: Page,
  options: { gameId: string; title: string; leaves: SeedLeaf[] },
): Promise<void> {
  const timestamp = new Date().toISOString();
  const gameId = options.gameId as GameId;
  const rootId = `${options.gameId}-root` as StoryNodeId;
  const nodeRecords: StoryNodeRecord[] = [
    buildNode(rootId, gameId, null, 1, null, `${options.title} begins.`, timestamp),
    ...options.leaves.map((leaf) =>
      buildNode(
        leaf.nodeId as StoryNodeId,
        gameId,
        rootId,
        2,
        leaf.choiceText,
        leaf.sceneText,
        timestamp,
      ),
    ),
  ];
  const gameRecord: GameRecord = {
    id: gameId,
    schemaVersion: 1,
    title: options.title,
    createdAt: timestamp,
    lastPlayedAt: timestamp,
    latestNodeId: nodeRecords[nodeRecords.length - 1].id,
    attachmentTexts: [],
  };

  await page.goto("/");
  // Absolute URL: Vite dev serves /src/*.ts as modules at runtime, while the
  // `typeof import(...)` keeps static types via the relative file path.
  await page.evaluate(
    async ({ seededGame, seededNodes }) => {
      const moduleUrl = new URL("/src/db/database.ts", window.location.origin).href;
      const { db } = (await import(moduleUrl)) as typeof import("../../src/db/database");
      await db.transaction("rw", [db.games, db.nodes], async () => {
        await db.games.add(seededGame);
        await db.nodes.bulkAdd(seededNodes);
      });
    },
    { seededGame: gameRecord, seededNodes: nodeRecords },
  );
  await page.reload();
}

/**
 * Stores a fake OpenRouter key (same dummy value as unit tests) so flows
 * that require `openrouterApiKey` proceed without touching the settings UI.
 */
export async function seedApiKey(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(async () => {
    const moduleUrl = new URL("/src/db/credentialsRepository.ts", window.location.origin).href;
    const { credentialsRepository } = (await import(
      moduleUrl
    )) as typeof import("../../src/db/credentialsRepository");
    await credentialsRepository.set("openrouterApiKey", "sk-or-test");
  });
  await page.reload();
}

/** Raw record counts, e.g. to prove the wipe emptied every store. */
export async function countRecords(page: Page): Promise<{ games: number; nodes: number }> {
  return page.evaluate(async () => {
    const moduleUrl = new URL("/src/db/database.ts", window.location.origin).href;
    const { db } = (await import(moduleUrl)) as typeof import("../../src/db/database");
    return { games: await db.games.count(), nodes: await db.nodes.count() };
  });
}

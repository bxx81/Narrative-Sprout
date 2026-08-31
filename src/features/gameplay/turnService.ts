import { gameRepository } from "../../db/gameRepository";
import type { GameId, GameRecord, StoryNodeId, StoryNodeRecord } from "../../types";
import { applyMemoryDelta } from "../narrative/memoryMerge";
import { buildOpeningPrompt, buildTurnPrompt } from "../narrative/promptBuilder";
import { generateNarration } from "../narrative/generateScene";
import { baseMemoryForNewNode } from "../storytree/treeTraversal";

function newUuid(): string {
  return crypto.randomUUID();
}

export interface StartGameParams {
  apiKey: string;
  model: string;
  theme: string;
  language: string;
  sceneTextLength: string;
}

/**
 * Creates a game and generates the opening scene (turn 1).
 * Persists GameRecord + root StoryNodeRecord in one transaction.
 */
export async function startGame(
  params: StartGameParams,
  options?: { signal?: AbortSignal },
): Promise<{ game: GameRecord; rootNode: StoryNodeRecord }> {
  const { system, messages } = buildOpeningPrompt(params);

  const generated = await generateNarration({
    apiKey: params.apiKey,
    model: params.model,
    system,
    messages,
    signal: options?.signal,
  });

  const now = new Date().toISOString();
  const gameId = newUuid() as GameId;
  const nodeId = newUuid() as StoryNodeId;

  const rootNode: StoryNodeRecord = {
    id: nodeId,
    gameId,
    parentNodeId: null,
    turnNumber: 1,
    choiceText: null,
    scene: generated.scene,
    promptSent: messages.map((m) => m.content).join("\n"),
    memory: applyMemoryDelta({ notes: {}, storyLog: [] }, generated.memoryDelta),
    memoryDelta: generated.memoryDelta,
    metadata: {
      generationCost: generated.generationCost,
      modelName: generated.modelName,
      discardHistoryContext: false,
      refinePrompt: null,
      refinedFromNodeId: null,
    },
    createdAt: now,
  };

  const game: GameRecord = {
    id: gameId,
    schemaVersion: 1,
    title: params.theme,
    createdAt: now,
    lastPlayedAt: now,
    latestNodeId: nodeId,
  };

  await gameRepository.createGame(game, rootNode);
  return { game, rootNode };
}

export interface ChoosePathParams {
  apiKey: string;
  model: string;
  game: GameRecord;
  parentNode: StoryNodeRecord;
  ancestors: StoryNodeRecord[]; // newest first, from collectAncestors
  choiceText: string;
  language: string;
  sceneTextLength: string;
}

/** Generates the next scene after a player choice and persists it. */
export async function choosePath(
  params: ChoosePathParams,
  options?: { signal?: AbortSignal },
): Promise<StoryNodeRecord> {
  const baseMemory = baseMemoryForNewNode(params.parentNode);
  const { system, messages } = buildTurnPrompt({
    theme: params.game.title,
    language: params.language,
    sceneTextLength: params.sceneTextLength,
    ancestorNodes: params.ancestors,
    memory: baseMemory,
    choiceText: params.choiceText,
  });

  const generated = await generateNarration({
    apiKey: params.apiKey,
    model: params.model,
    system,
    messages,
    signal: options?.signal,
  });

  const node: StoryNodeRecord = {
    id: newUuid() as StoryNodeId,
    gameId: params.game.id,
    parentNodeId: params.parentNode.id,
    turnNumber: params.parentNode.turnNumber + 1,
    choiceText: params.choiceText,
    scene: generated.scene,
    promptSent: params.choiceText,
    memory: applyMemoryDelta(baseMemory, generated.memoryDelta),
    memoryDelta: generated.memoryDelta,
    metadata: {
      generationCost: generated.generationCost,
      modelName: generated.modelName,
      discardHistoryContext: false,
      refinePrompt: null,
      refinedFromNodeId: null,
    },
    createdAt: new Date().toISOString(),
  };

  const updatedGame: GameRecord = {
    ...params.game,
    lastPlayedAt: node.createdAt,
    latestNodeId: node.id,
  };

  await gameRepository.appendNode(node, updatedGame);
  return node;
}

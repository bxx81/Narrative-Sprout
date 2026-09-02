import { gameRepository } from "../../db/gameRepository";
import type { GameId, GameRecord, StoryNodeId, StoryNodeRecord } from "../../types";
import type { MemoryState } from "../../types";
import {
  applyMemoryDelta,
  sceneToWireResponse,
  buildCompactionPrompt,
  buildMemoryUpdatePrompt,
  buildOpeningPrompt,
  buildTurnPrompt,
} from "../narrative/api";
import {
  generateMemoryUpdate,
  generateNarration,
  generateSceneOnly,
  generateStoryLogCompaction,
} from "../narrative/api";
import { baseMemoryForNewNode } from "../storytree/api";
import { resolveMemoryStrategy } from "../narrative/api";
import { debug } from "../../lib/debugLog";
import { compactMemory, shouldCompactStoryLog, splitStoryLog } from "../memory/api";
import {
  assetRecordFromDataUrl,
  generateSceneImage,
  webpQualityForCompression,
} from "../image/api";
import type { ImageGenConfig } from "../image/api";
import type { MemoryStrategy, WebpCompression } from "../../types/settings";

function newUuid(): string {
  return crypto.randomUUID();
}

export interface StartGameParams {
  apiKey: string;
  model: string;
  theme: string;
  language: string;
  sceneTextLength: string;
  attachmentTexts?: string[];
  imageGenConfig?: ImageGenConfig | null;
  webpCompression?: WebpCompression;
  memoryStrategy?: MemoryStrategy;
  enableStoryLogCompaction?: boolean;
  /** Live SSE deltas of the narration (streaming display). */
  onSceneTextDelta?: (accumulatedText: string) => void;
}

async function maybeCompactMemory(params: {
  memory: MemoryState;
  theme: string;
  language: string;
  attachmentTexts: string[];
  apiKey: string;
  model: string;
  signal?: AbortSignal;
  currentCost: number | null;
}): Promise<{ memory: MemoryState; cost: number | null }> {
  if (!shouldCompactStoryLog(params.memory.storyLog))
    return { memory: params.memory, cost: params.currentCost };
  const { older } = splitStoryLog(params.memory.storyLog);
  if (older.length === 0) return { memory: params.memory, cost: params.currentCost };
  try {
    const compactionPrompt = buildCompactionPrompt({
      theme: params.theme,
      language: params.language,
      storyLog: older,
      existingSummary: params.memory.storyLogSummary ?? "",
      attachmentTexts: params.attachmentTexts,
      flags: params.memory.notes,
    });
    const compaction = await generateStoryLogCompaction({
      apiKey: params.apiKey,
      model: params.model,
      system: compactionPrompt.system,
      messages: compactionPrompt.messages,
      signal: params.signal,
    });
    const compacted = compactMemory(params.memory, compaction.storyLogSummary, compaction.facts);
    const cost = (params.currentCost ?? 0) + (compaction.generationCost ?? 0);
    return { memory: compacted, cost };
  } catch (error) {
    console.warn("[compaction] failed, keeping storyLog:", error);
    return { memory: params.memory, cost: params.currentCost };
  }
}

/**
 * Creates a game and generates the opening scene (turn 1).
 * Persists GameRecord (+ optional asset) + root StoryNodeRecord in one transaction.
 */
export async function startGame(
  params: StartGameParams,
  options?: { signal?: AbortSignal },
): Promise<{ game: GameRecord; rootNode: StoryNodeRecord }> {
  debug.log("[turn] startGame:", params.theme);
  const attachmentTexts = params.attachmentTexts ?? [];
  const strategy = resolveMemoryStrategy(params.memoryStrategy, params.sceneTextLength);

  const { system, messages } = buildOpeningPrompt({
    theme: params.theme,
    language: params.language,
    sceneTextLength: params.sceneTextLength,
    attachmentTexts,
  });

  let scene: import("../../types").SceneContent;
  let memoryDelta: import("../../types").MemoryDelta;
  let generationCost: number | null = null;
  let modelName: string | null = null;
  let notesDraft = "";

  if (strategy === "single") {
    const generated = await generateNarration({
      apiKey: params.apiKey,
      model: params.model,
      system,
      messages,
      signal: options?.signal,
      onDelta: params.onSceneTextDelta,
    });
    scene = generated.scene;
    memoryDelta = generated.memoryDelta;
    generationCost = generated.generationCost;
    modelName = generated.modelName;
  } else {
    const sceneOnly = await generateSceneOnly({
      apiKey: params.apiKey,
      model: params.model,
      system,
      messages,
      signal: options?.signal,
      onDelta: params.onSceneTextDelta,
    });
    scene = sceneOnly.scene;
    notesDraft = sceneOnly.notesDraft;
    generationCost = sceneOnly.generationCost;
    modelName = sceneOnly.modelName;
    const memoryPrompt = buildMemoryUpdatePrompt({
      theme: params.theme,
      language: params.language,
      sceneText: scene.sceneText,
      notesDraft,
      attachmentTexts,
      memory: { notes: {}, storyLog: [] },
      turnNumber: 1,
    });
    const memoryResult = await generateMemoryUpdate({
      apiKey: params.apiKey,
      model: params.model,
      system: memoryPrompt.system,
      messages: memoryPrompt.messages,
      signal: options?.signal,
    });
    memoryDelta = memoryResult.memoryDelta;
    generationCost = (generationCost ?? 0) + (memoryResult.generationCost ?? 0);
    modelName = memoryResult.modelName ?? modelName;
  }

  if (!scene.locationContext) scene.locationContext = "";

  const now = new Date().toISOString();
  const gameId = newUuid() as GameId;
  const nodeId = newUuid() as StoryNodeId;

  let memory: MemoryState = applyMemoryDelta({ notes: {}, storyLog: [] }, memoryDelta);

  if (params.enableStoryLogCompaction !== false) {
    const compacted = await maybeCompactMemory({
      memory,
      theme: params.theme,
      language: params.language,
      attachmentTexts,
      apiKey: params.apiKey,
      model: params.model,
      signal: options?.signal,
      currentCost: generationCost,
    });
    memory = compacted.memory;
    generationCost = compacted.cost;
  }

  // promptSent is the user message actually sent (opening note), not the full attachment prefix.
  // History rebuilding uses promptSent + scene pairs; attachments are re-injected via prefix each turn.
  const promptSent = messages[messages.length - 1]?.content ?? "";

  const rootNode: StoryNodeRecord = {
    id: nodeId,
    gameId,
    parentNodeId: null,
    turnNumber: 1,
    choiceText: null,
    scene,
    promptSent,
    memory,
    memoryDelta,
    metadata: {
      generationCost,
      modelName,
      discardHistoryContext: false,
      refinePrompt: null,
      refinedFromNodeId: null,
      autoplayReasoning: null,
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
    attachmentTexts,
  };

  let asset: import("../../types/asset").AssetRecord | null = null;
  if (params.imageGenConfig && params.imageGenConfig.generator !== "disabled") {
    try {
      const dataUrl = await generateSceneImage({
        imagePrompt: scene.imagePrompt,
        negativeImagePrompt: scene.negativeImagePrompt,
        imageGenConfig: params.imageGenConfig,
        signal: options?.signal,
      });
      const quality = webpQualityForCompression(params.webpCompression ?? "normal");
      asset = await assetRecordFromDataUrl(nodeId, dataUrl, quality);
    } catch (error) {
      console.warn("[image] generation failed for root node:", error);
    }
  }

  await gameRepository.createGame(game, rootNode, asset);
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
  attachmentTexts?: string[];
  imageGenConfig?: ImageGenConfig | null;
  webpCompression?: WebpCompression;
  memoryStrategy?: MemoryStrategy;
  enableStoryLogCompaction?: boolean;
  /** Live text streaming from the narrative model (per-model opt-out possible). */
  onSceneTextDelta?: (accumulatedText: string) => void;
  /** Autoplay player-AI reasoning memo persisted with the produced node. */
  autoplayReasoning?: string;
  /** Autoplay decision call cost carried into this turn's total cost. */
  autoplayCost?: number;
  /**
   * Scene redo with context discard: the produced node permanently cuts
   * prompt history for its branch (its own metadata carries the flag).
   */
  discardHistoryContext?: boolean;
}

/** Generates the next scene after a player choice and persists it. */
export async function choosePath(
  params: ChoosePathParams,
  options?: { signal?: AbortSignal },
): Promise<StoryNodeRecord> {
  debug.log("[turn] choosePath:", {
    choiceText: params.choiceText,
    historyNodes: params.ancestors.length,
    discardHistoryContext: Boolean(params.discardHistoryContext),
  });
  const attachmentTexts = params.attachmentTexts ?? params.game.attachmentTexts ?? [];
  const baseMemory = baseMemoryForNewNode(params.parentNode);
  const strategy = resolveMemoryStrategy(params.memoryStrategy, params.sceneTextLength);

  const { system, messages } = buildTurnPrompt({
    theme: params.game.title,
    language: params.language,
    sceneTextLength: params.sceneTextLength,
    ancestorNodes: params.ancestors,
    memory: baseMemory,
    choiceText: params.choiceText,
    attachmentTexts,
    omitMemoryFields: strategy === "split",
  });

  let scene: import("../../types").SceneContent;
  let memoryDelta: import("../../types").MemoryDelta;
  let generationCost: number | null = null;
  let modelName: string | null = null;

  if (strategy === "single") {
    const generated = await generateNarration({
      apiKey: params.apiKey,
      model: params.model,
      system,
      messages,
      signal: options?.signal,
      onDelta: params.onSceneTextDelta,
    });
    scene = generated.scene;
    memoryDelta = generated.memoryDelta;
    generationCost = generated.generationCost;
    modelName = generated.modelName;
  } else {
    const sceneOnly = await generateSceneOnly({
      apiKey: params.apiKey,
      model: params.model,
      system,
      messages,
      signal: options?.signal,
      onDelta: params.onSceneTextDelta,
    });
    scene = sceneOnly.scene;
    generationCost = sceneOnly.generationCost;
    modelName = sceneOnly.modelName;
    const memoryPrompt = buildMemoryUpdatePrompt({
      theme: params.game.title,
      language: params.language,
      sceneText: scene.sceneText,
      notesDraft: sceneOnly.notesDraft,
      attachmentTexts,
      memory: baseMemory,
      turnNumber: params.parentNode.turnNumber + 1,
    });
    const memoryResult = await generateMemoryUpdate({
      apiKey: params.apiKey,
      model: params.model,
      system: memoryPrompt.system,
      messages: memoryPrompt.messages,
      signal: options?.signal,
    });
    memoryDelta = memoryResult.memoryDelta;
    generationCost = (generationCost ?? 0) + (memoryResult.generationCost ?? 0);
    modelName = memoryResult.modelName ?? modelName;
  }

  if (!scene.locationContext) {
    scene.locationContext = params.parentNode.scene.locationContext ?? "";
  }

  let memory: MemoryState = applyMemoryDelta(baseMemory, memoryDelta);

  if (params.enableStoryLogCompaction !== false) {
    const compacted = await maybeCompactMemory({
      memory,
      theme: params.game.title,
      language: params.language,
      attachmentTexts,
      apiKey: params.apiKey,
      model: params.model,
      signal: options?.signal,
      currentCost: generationCost,
    });
    memory = compacted.memory;
    generationCost = compacted.cost;
  }

  const nodeId = newUuid() as StoryNodeId;
  const node: StoryNodeRecord = {
    id: nodeId,
    gameId: params.game.id,
    parentNodeId: params.parentNode.id,
    turnNumber: params.parentNode.turnNumber + 1,
    choiceText: params.choiceText,
    scene: scene!,
    promptSent: params.choiceText,
    memory: memory!,
    memoryDelta: memoryDelta!,
    metadata: {
      // The autoplay decision call's cost rides on this turn's total (legacy
      // textCost += autoPlayCost).
      generationCost: (generationCost ?? 0) + (params.autoplayCost ?? 0) || null,
      modelName,
      discardHistoryContext: params.discardHistoryContext ?? false,
      refinePrompt: null,
      refinedFromNodeId: null,
      autoplayReasoning: params.autoplayReasoning ?? null,
    },
    createdAt: new Date().toISOString(),
  };

  let asset: import("../../types/asset").AssetRecord | null = null;
  if (params.imageGenConfig && params.imageGenConfig.generator !== "disabled") {
    try {
      const dataUrl = await generateSceneImage({
        imagePrompt: scene!.imagePrompt,
        negativeImagePrompt: scene!.negativeImagePrompt,
        imageGenConfig: params.imageGenConfig,
        signal: options?.signal,
      });
      const quality = webpQualityForCompression(params.webpCompression ?? "normal");
      asset = await assetRecordFromDataUrl(nodeId, dataUrl, quality);
    } catch (error) {
      console.warn("[image] generation failed:", error);
    }
  }

  const updatedGame: GameRecord = {
    ...params.game,
    lastPlayedAt: node.createdAt,
    latestNodeId: node.id,
  };

  await gameRepository.appendNode(node, updatedGame, asset);
  return node;
}

export interface RefineSceneParams {
  apiKey: string;
  model: string;
  game: GameRecord;
  targetNode: StoryNodeRecord;
  parentNode: StoryNodeRecord | null;
  ancestors: StoryNodeRecord[]; // for context (ancestors of parent)
  refinePrompt: string;
  language: string;
  sceneTextLength: string;
  attachmentTexts?: string[];
  imageGenConfig?: ImageGenConfig | null;
  webpCompression?: WebpCompression;
  memoryStrategy?: MemoryStrategy;
  enableStoryLogCompaction?: boolean;
  /** Live SSE deltas of the narration (streaming display). */
  onSceneTextDelta?: (accumulatedText: string) => void;
}

/**
 * Refines a scene by regenerating it as a sibling of `targetNode` under the same parent.
 * For root nodes, creates a new turn-1 sibling (same game, same turnNumber). The original
 * root remains; the new node becomes the latest.
 */
export async function refineScene(
  params: RefineSceneParams,
  options?: { signal?: AbortSignal },
): Promise<StoryNodeRecord> {
  const attachmentTexts = params.attachmentTexts ?? params.game.attachmentTexts ?? [];
  const isRoot = params.targetNode.parentNodeId === null;
  debug.log("[turn] refineScene:", {
    targetNodeId: params.targetNode.id,
    isRoot,
    instruction: params.refinePrompt,
  });

  const baseMemory = isRoot
    ? { notes: {}, storyLog: [] }
    : baseMemoryForNewNode(params.parentNode!);
  const strategy = resolveMemoryStrategy(params.memoryStrategy, params.sceneTextLength);

  const choiceText = params.targetNode.choiceText ?? "Begin the narrative.";
  // History/reference material must be shown in the wire shape the model
  // outputs (see sceneToWireResponse) or the regenerated response imitates
  // the stored shape and fails validation.
  const originalSceneJson = JSON.stringify(
    sceneToWireResponse(params.targetNode.scene, params.targetNode.memoryDelta, {
      omitMemoryFields: strategy === "split",
    }),
  );
  const refineInstruction =
    (isRoot
      ? `[Refine request for the first scene] Please regenerate the ENTIRE response based on instructions:\nOriginal scene:\n${originalSceneJson}\n\nUser instructions: ${params.refinePrompt}`
      : `[Refine request] The player chose: "${choiceText}". The following scene data was generated but needs correction. Please regenerate the ENTIRE response based on instructions:\nOriginal scene:\n${originalSceneJson}\n\nUser instructions: ${params.refinePrompt}`) +
    `\nTarget scene length: ${params.sceneTextLength}. Output ONLY the keys that changed in notes.`;

  let system: string;
  let messages: import("../../lib/openAiClient").ChatMessage[];

  if (isRoot) {
    const opening = buildOpeningPrompt({
      theme: params.game.title,
      language: params.language,
      sceneTextLength: params.sceneTextLength,
      attachmentTexts,
    });
    system = opening.system;
    messages = [...opening.messages.slice(0, -1), { role: "user", content: refineInstruction }];
  } else {
    const turn = buildTurnPrompt({
      theme: params.game.title,
      language: params.language,
      sceneTextLength: params.sceneTextLength,
      ancestorNodes: params.ancestors,
      memory: baseMemory,
      choiceText: refineInstruction,
      attachmentTexts,
      omitMemoryFields: strategy === "split",
    });
    system = turn.system;
    messages = turn.messages;
  }

  let scene: import("../../types").SceneContent;
  let memoryDelta: import("../../types").MemoryDelta;
  let generationCost: number | null = null;
  let modelName: string | null = null;

  if (strategy === "single") {
    const generated = await generateNarration({
      apiKey: params.apiKey,
      model: params.model,
      system,
      messages,
      signal: options?.signal,
      onDelta: params.onSceneTextDelta,
    });
    scene = generated.scene;
    memoryDelta = generated.memoryDelta;
    generationCost = generated.generationCost;
    modelName = generated.modelName;
  } else {
    const sceneOnly = await generateSceneOnly({
      apiKey: params.apiKey,
      model: params.model,
      system,
      messages,
      signal: options?.signal,
      onDelta: params.onSceneTextDelta,
    });
    scene = sceneOnly.scene;
    generationCost = sceneOnly.generationCost;
    modelName = sceneOnly.modelName;
    const memoryPrompt = buildMemoryUpdatePrompt({
      theme: params.game.title,
      language: params.language,
      sceneText: scene.sceneText,
      notesDraft: sceneOnly.notesDraft,
      attachmentTexts,
      memory: baseMemory,
      turnNumber: isRoot ? 1 : params.parentNode!.turnNumber + 1,
    });
    const memoryResult = await generateMemoryUpdate({
      apiKey: params.apiKey,
      model: params.model,
      system: memoryPrompt.system,
      messages: memoryPrompt.messages,
      signal: options?.signal,
    });
    memoryDelta = memoryResult.memoryDelta;
    generationCost = (generationCost ?? 0) + (memoryResult.generationCost ?? 0);
    modelName = memoryResult.modelName ?? modelName;
  }

  if (!scene!.locationContext) {
    scene!.locationContext = params.parentNode?.scene.locationContext ?? "";
  }

  let memory: MemoryState = applyMemoryDelta(baseMemory, memoryDelta!);

  if (params.enableStoryLogCompaction !== false) {
    const compacted = await maybeCompactMemory({
      memory,
      theme: params.game.title,
      language: params.language,
      attachmentTexts,
      apiKey: params.apiKey,
      model: params.model,
      signal: options?.signal,
      currentCost: generationCost,
    });
    memory = compacted.memory;
    generationCost = compacted.cost;
  }

  const nodeId = newUuid() as StoryNodeId;
  const turnNumber = isRoot ? 1 : params.parentNode!.turnNumber + 1;
  const node: StoryNodeRecord = {
    id: nodeId,
    gameId: params.game.id,
    parentNodeId: params.targetNode.parentNodeId,
    turnNumber,
    choiceText: params.targetNode.choiceText,
    scene: scene!,
    promptSent: refineInstruction,
    memory: memory!,
    memoryDelta: memoryDelta!,
    metadata: {
      generationCost,
      modelName,
      discardHistoryContext: false,
      refinePrompt: params.refinePrompt,
      refinedFromNodeId: params.targetNode.id as StoryNodeId,
      autoplayReasoning: null,
    },
    createdAt: new Date().toISOString(),
  };

  let asset: import("../../types/asset").AssetRecord | null = null;
  if (params.imageGenConfig && params.imageGenConfig.generator !== "disabled") {
    try {
      const dataUrl = await generateSceneImage({
        imagePrompt: scene!.imagePrompt,
        negativeImagePrompt: scene!.negativeImagePrompt,
        imageGenConfig: params.imageGenConfig,
        signal: options?.signal,
      });
      const quality = webpQualityForCompression(params.webpCompression ?? "normal");
      asset = await assetRecordFromDataUrl(nodeId, dataUrl, quality);
    } catch (error) {
      console.warn("[image] generation failed for refine:", error);
    }
  }

  const updatedGame: GameRecord = {
    ...params.game,
    lastPlayedAt: node.createdAt,
    latestNodeId: node.id,
  };

  await gameRepository.appendNode(node, updatedGame, asset);
  return node;
}

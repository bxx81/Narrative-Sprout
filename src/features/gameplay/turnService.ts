import { gameRepository } from "../../db/gameRepository";
import type { GameId, GameRecord, StoryNodeId, StoryNodeRecord } from "../../types";
import type { MemoryState } from "../../types";
import { applyMemoryDelta } from "../narrative/memoryMerge";
import {
  buildCompactionPrompt,
  buildMemoryUpdatePrompt,
  buildOpeningPrompt,
  buildTurnPrompt,
} from "../narrative/promptBuilder";
import {
  generateMemoryUpdate,
  generateNarration,
  generateSceneOnly,
  generateStoryLogCompaction,
} from "../narrative/generateScene";
import { baseMemoryForNewNode } from "../storytree/treeTraversal";
import { resolveMemoryStrategy } from "../narrative/resolveMemoryStrategy";
import { shouldCompactStoryLog, compactMemory } from "../memory/storyLogCompaction";
import { generateSceneImage } from "../image/generateImage";
import { assetRecordFromDataUrl, webpQualityForCompression } from "../image/assetHelpers";
import type { ImageGenConfig } from "../image/types";
import type { WebpCompression, MemoryStrategy } from "../../types/settings";

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
}

/**
 * Creates a game and generates the opening scene (turn 1).
 * Persists GameRecord (+ optional asset) + root StoryNodeRecord in one transaction.
 */
export async function startGame(
  params: StartGameParams,
  options?: { signal?: AbortSignal },
): Promise<{ game: GameRecord; rootNode: StoryNodeRecord }> {
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
    });
    scene = sceneOnly.scene;
    notesDraft = sceneOnly.notesDraft;
    generationCost = sceneOnly.generationCost;
    modelName = sceneOnly.modelName;
    // Memory update call (sequential for simplicity; legacy does parallel with image)
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

  // Location fallback: if empty carry from none (first turn has no parent)
  if (!scene.locationContext) scene.locationContext = "";

  const now = new Date().toISOString();
  const gameId = newUuid() as GameId;
  const nodeId = newUuid() as StoryNodeId;

  let memory: MemoryState = applyMemoryDelta({ notes: {}, storyLog: [] }, memoryDelta);

  // Compaction check (after first turn storyLog length is 1, so no compaction yet)
  if (params.enableStoryLogCompaction !== false && shouldCompactStoryLog(memory.storyLog)) {
    try {
      const compactionPrompt = buildCompactionPrompt({
        theme: params.theme,
        language: params.language,
        storyLog: memory.storyLog.slice(0, memory.storyLog.length - 20),
        existingSummary: memory.storyLogSummary ?? "",
        attachmentTexts,
        flags: memory.notes,
      });
      const compaction = await generateStoryLogCompaction({
        apiKey: params.apiKey,
        model: params.model,
        system: compactionPrompt.system,
        messages: compactionPrompt.messages,
        signal: options?.signal,
      });
      memory = compactMemory(memory, compaction.storyLogSummary, compaction.facts);
      generationCost = (generationCost ?? 0) + (compaction.generationCost ?? 0);
    } catch (error) {
      console.warn("[compaction] failed, keeping storyLog:", error);
    }
  }

  const rootNode: StoryNodeRecord = {
    id: nodeId,
    gameId,
    parentNodeId: null,
    turnNumber: 1,
    choiceText: null,
    scene,
    promptSent: messages.map((m) => m.content).join("\n"),
    memory,
    memoryDelta,
    metadata: {
      generationCost,
      modelName,
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
    attachmentTexts,
  };

  // Image generation (after narrative, before persistence)
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
}

/** Generates the next scene after a player choice and persists it. */
export async function choosePath(
  params: ChoosePathParams,
  options?: { signal?: AbortSignal },
): Promise<StoryNodeRecord> {
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
    // Parallelize memory and image? For now sequential for memory, then image after
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

  // Location fallback
  if (!scene.locationContext) {
    scene.locationContext = params.parentNode.scene.locationContext ?? "";
  }

  let memory: MemoryState = applyMemoryDelta(baseMemory, memoryDelta);

  if (params.enableStoryLogCompaction !== false && shouldCompactStoryLog(memory.storyLog)) {
    try {
      const compactionPrompt = buildCompactionPrompt({
        theme: params.game.title,
        language: params.language,
        storyLog: memory.storyLog.slice(0, memory.storyLog.length - 20),
        existingSummary: memory.storyLogSummary ?? "",
        attachmentTexts,
        flags: memory.notes,
      });
      const compaction = await generateStoryLogCompaction({
        apiKey: params.apiKey,
        model: params.model,
        system: compactionPrompt.system,
        messages: compactionPrompt.messages,
        signal: options?.signal,
      });
      memory = compactMemory(memory, compaction.storyLogSummary, compaction.facts);
      generationCost = (generationCost ?? 0) + (compaction.generationCost ?? 0);
    } catch (error) {
      console.warn("[compaction] failed:", error);
    }
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
      generationCost,
      modelName,
      discardHistoryContext: false,
      refinePrompt: null,
      refinedFromNodeId: null,
    },
    createdAt: new Date().toISOString(),
  };

  let asset: import("../../types/asset").AssetRecord | null = null;
  if (params.imageGenConfig && params.imageGenConfig.generator !== "disabled") {
    try {
      // For split strategy, legacy ran image in parallel with memory update.
      // Here we run after memory for simplicity; could be parallelized later.
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
  parentNode: StoryNodeRecord | null; // null for root refinement (handled as sibling)
  ancestors: StoryNodeRecord[]; // for context (ancestors of parent)
  refinePrompt: string;
  language: string;
  sceneTextLength: string;
  attachmentTexts?: string[];
  imageGenConfig?: ImageGenConfig | null;
  webpCompression?: WebpCompression;
  memoryStrategy?: MemoryStrategy;
  enableStoryLogCompaction?: boolean;
}

/**
 * Refines a scene by regenerating it as a sibling of `targetNode` under the same parent.
 * For root nodes (parentNode null), this creates a sibling root? Actually root has no parent,
 * but we treat it as creating a new sibling under the same game with same turnNumber.
 * For non-root, parent is target's parent.
 */
export async function refineScene(
  params: RefineSceneParams,
  options?: { signal?: AbortSignal },
): Promise<StoryNodeRecord> {
  const attachmentTexts = params.attachmentTexts ?? params.game.attachmentTexts ?? [];
  const isRoot = params.targetNode.parentNodeId === null;

  const baseMemory = isRoot
    ? { notes: {}, storyLog: [] }
    : baseMemoryForNewNode(params.parentNode!);
  const strategy = resolveMemoryStrategy(params.memoryStrategy, params.sceneTextLength);

  // Build refine instruction
  const choiceText = params.targetNode.choiceText ?? "Begin the narrative.";
  const originalSceneJson = JSON.stringify(params.targetNode.scene);
  const refineInstruction =
    (isRoot
      ? `[Refine request for the first scene] Please regenerate the ENTIRE response based on instructions:\nOriginal scene:\n${originalSceneJson}\n\nUser instructions: ${params.refinePrompt}`
      : `[Refine request] The player chose: "${choiceText}". The following scene data was generated but needs correction. Please regenerate the ENTIRE response based on instructions:\nOriginal scene:\n${originalSceneJson}\n\nUser instructions: ${params.refinePrompt}`) +
    `\nTarget scene length: ${params.sceneTextLength}. Output ONLY the keys that changed in notes.`; // length hint handled by promptBuilder

  // Reuse turn prompt building but with refineInstruction as choiceText
  // For root, we use opening prompt style but inject refineInstruction
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
    // Replace opening user note with refine instruction
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

  if (params.enableStoryLogCompaction !== false && shouldCompactStoryLog(memory.storyLog)) {
    try {
      const compactionPrompt = buildCompactionPrompt({
        theme: params.game.title,
        language: params.language,
        storyLog: memory.storyLog.slice(0, memory.storyLog.length - 20),
        existingSummary: memory.storyLogSummary ?? "",
        attachmentTexts,
        flags: memory.notes,
      });
      const compaction = await generateStoryLogCompaction({
        apiKey: params.apiKey,
        model: params.model,
        system: compactionPrompt.system,
        messages: compactionPrompt.messages,
        signal: options?.signal,
      });
      memory = compactMemory(memory, compaction.storyLogSummary, compaction.facts);
      generationCost = (generationCost ?? 0) + (compaction.generationCost ?? 0);
    } catch (error) {
      console.warn("[compaction] failed:", error);
    }
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

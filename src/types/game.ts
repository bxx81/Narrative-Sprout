import { z } from "zod";
import { gameIdSchema, storyNodeIdSchema } from "./ids";
import { memoryDeltaSchema, memoryStateSchema, sceneContentSchema } from "./scene";

/**
 * Core persisted records (REDESIGN.md §5.2).
 *
 * - `GameRecord`      : one playthrough (save slot header). Holds NO settings
 *                       or secrets — those are global (§5.4).
 * - `StoryNodeRecord` : one turn of the story tree. Its image asset lives in
 *                       the `assets` store keyed by the same node id (§5.3);
 *                       there is intentionally no asset reference field here.
 */

export const gameRecordSchema = z.object({
  id: gameIdSchema,
  /** Integer schema version for the future migration chain (§5.6). */
  schemaVersion: z.number().int().positive(),
  /** The world theme text shown as the save's display title. */
  title: z.string(),
  createdAt: z.string(), // ISO 8601
  lastPlayedAt: z.string(), // ISO 8601
  /** Reference-only pointer used by the save list; no duplicated scene data. */
  latestNodeId: storyNodeIdSchema.nullable(),
  /** Attachment texts for this game (YAML front matter already resolved, {a|b} applied). */
  attachmentTexts: z.array(z.string()).optional().default([]),
});
export type GameRecord = z.infer<typeof gameRecordSchema>;

/** Auxiliary per-node information that is safe to lose but useful to keep. */
export const nodeMetadataSchema = z.object({
  /** API cost of generating this turn, if reported. */
  generationCost: z.number().nullable(),
  /** Text model that produced this turn. */
  modelName: z.string().nullable(),
  /** When true, history-building stops including older context past this node. */
  discardHistoryContext: z.boolean(),
  /** Refinement instruction used, if this node is a refined sibling. */
  refinePrompt: z.string().nullable(),
  /** Sibling node this node refines, if any. */
  refinedFromNodeId: storyNodeIdSchema.nullable(),
});
export type NodeMetadata = z.infer<typeof nodeMetadataSchema>;

export const storyNodeRecordSchema = z.object({
  id: storyNodeIdSchema,
  gameId: gameIdSchema,
  /** `null` on the root node (game start). */
  parentNodeId: storyNodeIdSchema.nullable(),
  /** Game start is turn 1. */
  turnNumber: z.number().int().positive(),
  /** The choice that led to this node; `null` on the root node. */
  choiceText: z.string().nullable(),
  scene: sceneContentSchema,
  /**
   * The user message actually sent to the API for this turn. Required for
   * rebuilding the pseudo-conversation history of past turns (§5.2) — do not
   * remove: it cannot be recomputed from `choiceText` alone.
   */
  promptSent: z.string(),
  /** Long-term memory accumulated up to and including this turn. */
  memory: memoryStateSchema,
  /** This turn's memory delta (kept for resending the memory-update call). */
  memoryDelta: memoryDeltaSchema,
  metadata: nodeMetadataSchema,
  createdAt: z.string(), // ISO 8601
});
export type StoryNodeRecord = z.infer<typeof storyNodeRecordSchema>;

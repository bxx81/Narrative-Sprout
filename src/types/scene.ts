import { z } from "zod";

/**
 * Scene-related schemas and types (REDESIGN.md §5.2 / §6.2).
 *
 * Glossary:
 * - `SceneContent`   : what the player sees and what image generation uses.
 * - `MemoryState`    : the AI's long-term memory accumulated up to a turn.
 * - `MemoryDelta`    : the memory change produced by a single turn (kept for
 *                      resend/retry of the memory-update call).
 *
 * Types are derived from schemas via `z.infer` — never declare them twice.
 */

/** A single turn's memory update produced by the AI. */
export const memoryDeltaSchema = z.object({
  /** Key-value notes updated this turn. `null` deletes the key. */
  notes: z.record(z.string(), z.string().nullable()),
  /** One-line summary of this turn's scene. */
  sceneSummary: z.string(),
});
export type MemoryDelta = z.infer<typeof memoryDeltaSchema>;

/** Accumulated long-term memory at a given point in the story. */
export const memoryStateSchema = z.object({
  /** Accumulated key-value notes. */
  notes: z.record(z.string(), z.string().nullable()),
  /** Accumulated per-turn scene summaries, oldest first. */
  storyLog: z.array(z.string()),
  /** Compacted digest of old storyLog entries (set by log compaction). */
  storyLogSummary: z.string().optional(),
});
export type MemoryState = z.infer<typeof memoryStateSchema>;

/** The narrative content of one story node (what the player experiences). */
export const sceneContentSchema = z.object({
  /** The model's scratchpad/thinking before writing the scene. */
  reasoning: z.string(),
  /** The literary prose of the scene. */
  sceneText: z.string(),
  /** Word count of `sceneText` (renamed from legacy `wordsSceneText`). */
  sceneWordCount: z.number().int().nonnegative(),
  /** Prompt used for this scene's illustration. */
  imagePrompt: z.string(),
  /** Negative prompt used for this scene's illustration. */
  negativeImagePrompt: z.string(),
  /** Choices offered to the player at the end of the scene. */
  choices: z.array(z.string()),
  /** Whether the story concluded in this scene. */
  isStoryOver: z.boolean(),
  /** Literary closing passage shown when the story concludes. */
  storyClosingText: z.string(),
  /** Current location context, carried forward across turns. */
  locationContext: z.string(),
});
export type SceneContent = z.infer<typeof sceneContentSchema>;

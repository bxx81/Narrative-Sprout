import { z } from "zod";
import type { MemoryDelta, SceneContent } from "../../types/scene";

/**
 * Wire schema: the JSON the narrator model is asked to output each turn.
 * Choice fields are split (choice1..3) rather than an array — array outputs
 * proved unreliable across models in the legacy implementation.
 *
 * The stored shape (`SceneContent`, `MemoryDelta`) differs slightly; see
 * `toSceneContent` / `toMemoryDelta` for the conversion.
 */
export const narratorSceneResponseSchema = z.object({
  sceneText: z
    .string()
    .describe(
      "A rich, immersive prose passage for the current scene, in literary-novel style. " +
        "Avoid game-like narration ('You see...'). Use third-person or close third-person. " +
        "Break long passages into paragraphs separated by \\n.",
    ),
  locationContext: z
    .string()
    .nullable()
    .describe(
      "The scene's location/environment/lighting. Required for the first scene. " +
        "Later scenes: only if it changed significantly, otherwise null.",
    ),
  imagePrompt: z
    .string()
    .describe("A detailed visual prompt for image generation. MUST be in English."),
  negativeImagePrompt: z
    .string()
    .nullable()
    .describe("Elements to avoid in the image, in English. null if not needed."),
  choice1: z.string().describe("Branching path 1, under 10 words, natural continuation."),
  choice2: z.string().describe("Branching path 2, under 10 words, natural continuation."),
  choice3: z.string().describe("Branching path 3, under 10 words, natural continuation."),
  isStoryOver: z.boolean().describe("true only when the story reaches its natural conclusion now."),
  finalEndingPassage: z
    .string()
    .describe('Closing passage when isStoryOver is true, otherwise "".'),
  sceneSummary: z
    .string()
    .describe("Objective 1-line factual summary of this scene (top-level, NOT in notes)."),
  notes: z
    .record(z.string(), z.string().nullable())
    .describe(
      "Long-term memory key-value updates. Output ONLY changed keys; null deletes a key. " +
        "Use char:/status:/lore:/flag:/num: prefixes.",
    ),
});
export type NarratorSceneResponse = z.infer<typeof narratorSceneResponseSchema>;

/** Shape of a past turn replayed to the model as an assistant message. */
export interface SceneWireResponse {
  sceneText: string;
  locationContext: string;
  imagePrompt: string;
  negativeImagePrompt: string;
  choice1: string;
  choice2: string;
  choice3: string;
  isStoryOver: boolean;
  finalEndingPassage: string;
  sceneSummary?: string;
  notes?: Record<string, string | null>;
}

/**
 * Rebuilds the wire-format JSON of a past turn from its stored record, for
 * replaying it in the conversation history.
 *
 * History MUST be shown in the exact shape the model is asked to output:
 * on providers without strict json_schema enforcement the model imitates the
 * history instead, so a stored-shape replay (`choices` array, `sceneWordCount`,
 * ...) makes the next response fail validation. Legacy equivalent:
 * `stored2work` ("LLMの出力と同じ型にしないと汚染されるので揃える").
 */
export function sceneToWireResponse(
  scene: SceneContent,
  memoryDelta?: MemoryDelta,
  options?: { omitMemoryFields?: boolean },
): SceneWireResponse {
  const includeMemory = memoryDelta !== undefined && !options?.omitMemoryFields;
  return {
    sceneText: scene.sceneText,
    locationContext: scene.locationContext,
    imagePrompt: scene.imagePrompt,
    negativeImagePrompt: scene.negativeImagePrompt,
    choice1: scene.choices[0] ?? "",
    choice2: scene.choices[1] ?? "",
    choice3: scene.choices[2] ?? "",
    isStoryOver: scene.isStoryOver,
    finalEndingPassage: scene.storyClosingText,
    ...(includeMemory && memoryDelta.sceneSummary
      ? { sceneSummary: memoryDelta.sceneSummary }
      : {}),
    ...(includeMemory && Object.keys(memoryDelta.notes).length > 0
      ? { notes: memoryDelta.notes }
      : {}),
  };
}

/**
 * Prompt-embedded JSON schema text for non-strict providers
 * (`--strict=false`): the request uses `json_object` and the schema text is
 * appended to the system prompt instead.
 */
export function buildSchemaPromptText(schema: z.ZodType): string {
  return JSON.stringify(z.toJSONSchema(schema), null, 2);
}

/** Scene-only response for split strategy (call 1): no notes/sceneSummary. */
export const narratorSceneOnlyResponseSchema = z.object({
  sceneText: z
    .string()
    .describe(
      "A rich, immersive prose passage for the current scene, in literary-novel style. " +
        "Avoid game-like narration. Use third-person or close third-person. " +
        "Break long passages into paragraphs separated by \\n.",
    ),
  locationContext: z
    .string()
    .nullable()
    .describe(
      "Location/environment/lighting. Required for first scene. Later: only if changed significantly, otherwise null.",
    ),
  imagePrompt: z
    .string()
    .describe("A detailed visual prompt for image generation. MUST be in English."),
  negativeImagePrompt: z
    .string()
    .nullable()
    .describe("Elements to avoid in the image, in English. null if not needed."),
  choice1: z.string().describe("Branching path 1, under 10 words, natural continuation."),
  choice2: z.string().describe("Branching path 2, under 10 words, natural continuation."),
  choice3: z.string().describe("Branching path 3, under 10 words, natural continuation."),
  isStoryOver: z.boolean().describe("true only when the story reaches its natural conclusion now."),
  finalEndingPassage: z
    .string()
    .describe('Closing passage when isStoryOver is true, otherwise "".'),
  notesDraft: z
    .string()
    .nullable()
    .describe('Optional throwaway memory note for the memory keeper. Set to "" if not needed.'),
});
export type NarratorSceneOnlyResponse = z.infer<typeof narratorSceneOnlyResponseSchema>;

/** Memory-only response for split strategy (call 2). */
export const memoryUpdateResponseSchema = z.object({
  sceneSummary: z
    .string()
    .describe("(Top-level, NOT in notes) Objective 1-line factual summary of this scene."),
  notes: z
    .record(z.string(), z.string().nullable())
    .describe("Memory key-value updates. Output ONLY changed keys; null deletes."),
});
export type MemoryUpdateResponse = z.infer<typeof memoryUpdateResponseSchema>;

/** Archivist compaction response (storyLogSummary + facts). */
export const storyLogCompactionResponseSchema = z.object({
  storyLogSummary: z.string().describe("Compressed chronicle preserving ALL plot-critical facts."),
  facts: z
    .record(z.string(), z.string().nullable())
    .describe("Durable facts to promote into notes (flag:/num:/lore: only)."),
});
export type StoryLogCompactionResponse = z.infer<typeof storyLogCompactionResponseSchema>;

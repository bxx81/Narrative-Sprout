import { z } from "zod";

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

/** JSON Schema for the OpenAI `response_format` (OpenRouter structured output). */
export function buildNarratorResponseFormat() {
  return {
    type: "json_schema" as const,
    json_schema: {
      name: "narrator_scene",
      strict: true,
      schema: z.toJSONSchema(narratorSceneResponseSchema) as Record<string, unknown>,
    },
  };
}

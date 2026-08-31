import { OpenAiCompatibleClient } from "../../lib/openAiClient";
import type { MemoryDelta, SceneContent } from "../../types";
import { buildNarratorResponseFormat, narratorSceneResponseSchema } from "./sceneSchema";

function countWords(text: string): number {
  // Japanese/CJK prose has no spaces: fall back to character count there.
  const byWords = text.trim().split(/\s+/).filter(Boolean).length;
  return byWords > 1 ? byWords : [...text.replace(/\s/g, "")].length;
}

export class NarrationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "NarrationError";
  }
}

/** The narrative result of one LLM call, before persistence. */
export interface GeneratedTurn {
  scene: SceneContent;
  memoryDelta: MemoryDelta;
  generationCost: number | null;
  modelName: string | null;
}

/**
 * Sends system+messages to the narrator model and converts the validated
 * response into our internal scene/memory shapes.
 */
export async function generateNarration(params: {
  apiKey: string;
  model: string;
  system: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  signal?: AbortSignal;
}): Promise<GeneratedTurn> {
  const client = new OpenAiCompatibleClient(params.apiKey);
  const response = await client.createChatCompletion(
    {
      model: params.model,
      messages: [{ role: "system", content: params.system }, ...params.messages],
      response_format: buildNarratorResponseFormat(),
    },
    { signal: params.signal },
  );

  const raw = response.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || raw.length === 0) {
    const reason = response.error?.message ?? "empty content";
    throw new NarrationError(`Narrator returned no scene: ${reason}`);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    throw new NarrationError("Narrator returned invalid JSON", error);
  }

  const parsed = narratorSceneResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new NarrationError(
      `Narrator response failed validation: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }
  const out = parsed.data;

  const scene: SceneContent = {
    reasoning: "",
    sceneText: out.sceneText,
    sceneWordCount: countWords(out.sceneText),
    imagePrompt: out.imagePrompt,
    negativeImagePrompt: out.negativeImagePrompt ?? "",
    choices: [out.choice1, out.choice2, out.choice3],
    isStoryOver: out.isStoryOver,
    storyClosingText: out.finalEndingPassage,
    locationContext: out.locationContext ?? "",
  };

  const memoryDelta: MemoryDelta = { notes: out.notes, sceneSummary: out.sceneSummary };

  return {
    scene,
    memoryDelta,
    generationCost: response.usage?.cost ?? null,
    modelName: response.model ?? null,
  };
}

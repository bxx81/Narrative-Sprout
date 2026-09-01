import { OpenAiCompatibleClient } from "../../lib/openAiClient";
import type { MemoryDelta, SceneContent } from "../../types";
import {
  buildCompactionResponseFormat,
  buildMemoryUpdateResponseFormat,
  buildNarratorResponseFormat,
  buildSceneOnlyResponseFormat,
  memoryUpdateResponseSchema,
  narratorSceneOnlyResponseSchema,
  narratorSceneResponseSchema,
  storyLogCompactionResponseSchema,
} from "./sceneSchema";

export function countWords(text: string): number {
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
  notesDraft?: string;
}

/** Scene-only result (split strategy call 1). */
export interface GeneratedSceneOnly {
  scene: SceneContent;
  notesDraft: string;
  generationCost: number | null;
  modelName: string | null;
}

export interface GeneratedMemoryUpdate {
  memoryDelta: MemoryDelta;
  generationCost: number | null;
  modelName: string | null;
}

export interface GeneratedCompaction {
  storyLogSummary: string;
  facts: Record<string, string | null>;
  generationCost: number | null;
  modelName: string | null;
}

async function callChatCompletion(params: {
  apiKey: string;
  model: string;
  system: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  responseFormat: Record<string, unknown>;
  signal?: AbortSignal;
}) {
  const client = new OpenAiCompatibleClient(params.apiKey);
  const response = await client.createChatCompletion(
    {
      model: params.model,
      messages: [{ role: "system", content: params.system }, ...params.messages],
      response_format: params.responseFormat as never,
    },
    { signal: params.signal },
  );
  const raw = response.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || raw.length === 0) {
    const reason = response.error?.message ?? "empty content";
    throw new NarrationError(`LLM returned no content: ${reason}`);
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    throw new NarrationError("LLM returned invalid JSON", error);
  }
  return { parsedJson, response };
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
  const { parsedJson, response } = await callChatCompletion({
    apiKey: params.apiKey,
    model: params.model,
    system: params.system,
    messages: params.messages,
    responseFormat: buildNarratorResponseFormat(),
    signal: params.signal,
  });

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

export async function generateSceneOnly(params: {
  apiKey: string;
  model: string;
  system: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  signal?: AbortSignal;
}): Promise<GeneratedSceneOnly> {
  const { parsedJson, response } = await callChatCompletion({
    apiKey: params.apiKey,
    model: params.model,
    system: params.system,
    messages: params.messages,
    responseFormat: buildSceneOnlyResponseFormat(),
    signal: params.signal,
  });
  const parsed = narratorSceneOnlyResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new NarrationError(
      `Scene-only response failed validation: ${parsed.error.issues[0]?.message ?? "unknown"}`,
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
  return {
    scene,
    notesDraft: out.notesDraft ?? "",
    generationCost: response.usage?.cost ?? null,
    modelName: response.model ?? null,
  };
}

export async function generateMemoryUpdate(params: {
  apiKey: string;
  model: string;
  system: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  signal?: AbortSignal;
}): Promise<GeneratedMemoryUpdate> {
  const { parsedJson, response } = await callChatCompletion({
    apiKey: params.apiKey,
    model: params.model,
    system: params.system,
    messages: params.messages,
    responseFormat: buildMemoryUpdateResponseFormat(),
    signal: params.signal,
  });
  const parsed = memoryUpdateResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new NarrationError(
      `Memory update failed validation: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }
  const out = parsed.data;
  const memoryDelta: MemoryDelta = { notes: out.notes, sceneSummary: out.sceneSummary };
  return {
    memoryDelta,
    generationCost: response.usage?.cost ?? null,
    modelName: response.model ?? null,
  };
}

export async function generateStoryLogCompaction(params: {
  apiKey: string;
  model: string;
  system: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  signal?: AbortSignal;
}): Promise<GeneratedCompaction> {
  const { parsedJson, response } = await callChatCompletion({
    apiKey: params.apiKey,
    model: params.model,
    system: params.system,
    messages: params.messages,
    responseFormat: buildCompactionResponseFormat(),
    signal: params.signal,
  });
  const parsed = storyLogCompactionResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new NarrationError(
      `Compaction response failed validation: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }
  const out = parsed.data;
  return {
    storyLogSummary: out.storyLogSummary,
    facts: out.facts,
    generationCost: response.usage?.cost ?? null,
    modelName: response.model ?? null,
  };
}

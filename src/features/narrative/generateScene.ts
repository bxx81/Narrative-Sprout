import { z } from "zod";
import { OpenAiCompatibleClient, ApiError } from "../../lib/openAiClient";
import type { ChatCompletionRequest } from "../../lib/openAiClient";
import { buildSamplingParams, parseTextModelOptions } from "../../lib/modelOptions";
import { debug } from "../../lib/debugLog";
import type { MemoryDelta, SceneContent } from "../../types";
import {
  buildSchemaPromptText,
  cleanJsonSchemaForStructuredOutputs,
  memoryUpdateResponseSchema,
  narratorSceneOnlyResponseSchema,
  narratorSceneResponseSchema,
  storyLogCompactionResponseSchema,
} from "./sceneSchema";
import { countWords } from "./wordCount";

/**
 * Statuses that mean the provider rejected streaming itself (legacy
 * STREAM_REJECT_STATUSES); the call then falls back to bulk delivery once.
 */
const STREAM_REJECT_STATUSES = new Set([400, 404, 415, 422]);

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
  /** Zod schema the response must satisfy (also drives response_format). */
  responseSchema: z.ZodType;
  responseSchemaName: string;
  signal?: AbortSignal;
  /** When present, the narration is delivered via SSE with live deltas. */
  onDelta?: (accumulatedText: string) => void;
}) {
  const modelOptions = parseTextModelOptions(params.model);
  if (!modelOptions.isValid) {
    throw new NarrationError("Model setting is invalid.");
  }
  const client = new OpenAiCompatibleClient(params.apiKey, modelOptions.baseUrl);
  const responseFormat = modelOptions.strict
    ? {
        type: "json_schema" as const,
        json_schema: {
          name: params.responseSchemaName,
          strict: true,
          // Some providers 400 on zod v4's `propertyNames` / `$schema`
          // keywords — strip them (legacy cleanJsonSchemaForStructuredOutputs).
          schema: cleanJsonSchemaForStructuredOutputs(
            z.toJSONSchema(params.responseSchema),
          ) as Record<string, unknown>,
        },
      }
    : { type: "json_object" as const };
  const systemContent = modelOptions.strict
    ? params.system
    : `${params.system}\n\nHere is the required JSON schema:\n\`\`\`json\n${buildSchemaPromptText(
        params.responseSchema,
      )}\n\`\`\`\n`;
  const requestBody: ChatCompletionRequest = {
    model: modelOptions.model,
    messages: [{ role: "system", content: systemContent }, ...params.messages],
    response_format: responseFormat as never,
    ...buildSamplingParams(modelOptions),
  };
  const willStream = Boolean(params.onDelta && modelOptions.stream);
  debug.groupCollapsed(`[llm] call ${modelOptions.model} (stream: ${willStream})`);
  debug.log(
    "messages:",
    params.messages.map((message) => ({
      role: message.role,
      length: message.content.length,
      preview: message.content.slice(0, 300),
    })),
  );
  debug.log("request options:", {
    strict: modelOptions.strict,
    timeoutMs: modelOptions.timeoutMs,
    baseUrl: modelOptions.baseUrl,
  });
  debug.groupEnd();
  const signal = params.signal
    ? AbortSignal.any([params.signal, AbortSignal.timeout(modelOptions.timeoutMs)])
    : AbortSignal.timeout(modelOptions.timeoutMs);
  let response;
  if (params.onDelta && modelOptions.stream) {
    try {
      response = await client.createStreamingChatCompletion(requestBody, {
        signal,
        onDelta: params.onDelta,
      });
    } catch (error) {
      if (error instanceof ApiError && STREAM_REJECT_STATUSES.has(error.status)) {
        // This endpoint does not accept streaming: retry once in bulk.
        debug.warn(`[llm] streaming rejected (HTTP ${error.status}); retrying in bulk mode`);
        response = await client.createChatCompletion(requestBody, { signal });
      } else {
        throw error;
      }
    }
  } else {
    response = await client.createChatCompletion(requestBody, { signal });
  }
  debug.log("[llm] response:", {
    model: response.model,
    cost: response.usage?.cost,
    finishReason: response.choices?.[0]?.finish_reason,
    contentLength: response.choices?.[0]?.message?.content?.length ?? 0,
  });
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
  onDelta?: (accumulatedText: string) => void;
}): Promise<GeneratedTurn> {
  const { parsedJson, response } = await callChatCompletion({
    apiKey: params.apiKey,
    model: params.model,
    system: params.system,
    messages: params.messages,
    responseSchema: narratorSceneResponseSchema,
    responseSchemaName: "narrator_scene",
    signal: params.signal,
    onDelta: params.onDelta,
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
  onDelta?: (accumulatedText: string) => void;
}): Promise<GeneratedSceneOnly> {
  const { parsedJson, response } = await callChatCompletion({
    apiKey: params.apiKey,
    model: params.model,
    system: params.system,
    messages: params.messages,
    responseSchema: narratorSceneOnlyResponseSchema,
    responseSchemaName: "narrator_scene_only",
    signal: params.signal,
    onDelta: params.onDelta,
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
    responseSchema: memoryUpdateResponseSchema,
    responseSchemaName: "memory_update",
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
    responseSchema: storyLogCompactionResponseSchema,
    responseSchemaName: "story_log_compaction",
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

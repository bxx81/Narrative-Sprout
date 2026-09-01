import { z } from "zod";
import { OpenAiCompatibleClient } from "../../lib/openAiClient";
import { buildSamplingParams, parseTextModelOptions } from "../../lib/modelOptions";
import type { Translation } from "./index";

/**
 * AI dynamic UI translation (REDESIGN §4.2): translates the bundled English
 * UI texts into an arbitrary user-typed language, chunk by chunk, and detects
 * the IETF tag for the DOM/i18next. Ported from the legacy translateService.
 */

const CHUNK_SIZE = 30;
const POLITENESS_DELAY_MS = 500;

const languageTable: Record<string, string> = {
  english: "en",
  "mandarin chinese": "zh",
  简体中文: "zh",
  普通话: "zh",
  hindi: "hi",
  हिन्दी: "hi",
  spanish: "es",
  español: "es",
  arabic: "ar",
  العربية: "ar",
  french: "fr",
  français: "fr",
  bengali: "bn",
  বাংলা: "bn",
  portuguese: "pt",
  português: "pt",
  indonesian: "id",
  "bahasa indonesia": "id",
  urdu: "ur",
  اردو: "ur",
  russian: "ru",
  русский: "ru",
  german: "de",
  deutsch: "de",
  japanese: "ja",
  日本語: "ja",
  marathi: "mr",
  मराठी: "mr",
  vietnamese: "vi",
  "tiếng việt": "vi",
  telugu: "te",
  తెలుగు: "te",
  swahili: "sw",
  kiswahili: "sw",
  turkish: "tr",
  türkçe: "tr",
  korean: "ko",
  한국어: "ko",
  tamil: "ta",
  தமிழ்: "ta",
  thai: "th",
  ไทย: "th",
  italian: "it",
  italiano: "it",
};

function chunkPrompt(targetLanguage: string, englishChunk: Translation): string {
  return `You are a localization expert specializing in video game UI text.

CONTEXT — About this application:
"Narrative Sprout" is an AI-driven interactive novel game. The player sets a story theme, and the AI generates scene text, an accompanying illustration, and three choices for the next action in real time. By replaying from earlier scenes, the story branches into a tree-like structure. Key features include: automatic save, branching history navigation, story export, Google Drive backup, and AI-powered UI translation into arbitrary languages. UI strings therefore cover menus, settings, gameplay prompts, error messages, and instructional copy.

Translate the JSON values from English to "${targetLanguage}".
IMPORTANT:
- You MUST NOT translate the JSON keys.
- The output MUST be a valid JSON object.
- The output MUST have the exact same keys as the input.
- Your entire response MUST be only the JSON object.

Here is the JSON to translate:
${JSON.stringify(englishChunk)}
`;
}

function chunkSchema(englishChunk: Translation): z.ZodType {
  const schemaShape: Record<string, z.ZodType> = {};
  for (const key of Object.keys(englishChunk)) {
    schemaShape[key] = z.string();
  }
  return z.object(schemaShape);
}

async function translateChunk(params: {
  client: OpenAiCompatibleClient;
  textModel: string;
  targetLanguage: string;
  englishChunk: Translation;
  signal?: AbortSignal;
}): Promise<Translation> {
  const modelOptions = parseTextModelOptions(params.textModel);
  if (!modelOptions.isValid) {
    throw new Error("Model setting is invalid.");
  }
  // Be a good API citizen between sequential chunk calls.
  await new Promise((resolve) => setTimeout(resolve, POLITENESS_DELAY_MS));
  const prompt = `${chunkPrompt(params.targetLanguage, params.englishChunk)}${
    modelOptions.strict
      ? ""
      : `\nRequired JSON schema (keys MUST match the input exactly):\n${JSON.stringify(
          z.toJSONSchema(chunkSchema(params.englishChunk)),
          null,
          2,
        )}\n`
  }`;
  const response = await params.client.createChatCompletion(
    {
      model: modelOptions.model,
      response_format: (modelOptions.strict
        ? {
            type: "json_schema",
            json_schema: {
              name: "translation",
              strict: true,
              schema: z.toJSONSchema(chunkSchema(params.englishChunk)),
            },
          }
        : { type: "json_object" }) as never,
      messages: [{ role: "user", content: prompt }],
      ...buildSamplingParams(modelOptions),
    },
    { signal: params.signal },
  );
  const raw = response.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error("Empty response from AI for UI translation chunk.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("AI translation chunk returned invalid JSON", { cause: error });
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI translation chunk returned a non-object response.");
  }
  // Ensure every key of the chunk is present, falling back to English when
  // the model omitted a key.
  const resultJson: Translation = {};
  for (const [key, englishText] of Object.entries(params.englishChunk)) {
    const translated = (parsed as Record<string, unknown>)[key];
    resultJson[key] =
      typeof translated === "string" && translated.length > 0 ? translated : englishText;
  }
  return resultJson;
}

/**
 * Gets the IETF language tag for a language name: hardcoded checks for the
 * built-ins, a common-language table, then an LLM call with regex validation
 * (falls back to the original name when detection fails).
 */
export async function getTranslateLanguageCode(params: {
  apiKey: string;
  textModel: string;
  languageName: string;
  signal?: AbortSignal;
}): Promise<string> {
  switch (params.languageName.toLowerCase()) {
    case "japanese":
    case "日本語":
      return "ja";
    case "chinese":
    case "汉语":
      return "zh";
    case "korean":
    case "한국어":
      return "ko";
    case "taiwanese":
    case "臺灣華語":
      return "zh-tw";
    case "english":
      return "en";
  }

  const lowerName = params.languageName.toLowerCase();
  if (lowerName in languageTable) return languageTable[lowerName]!;

  const prompt = `What is the most common IETF language tag (e.g., "en", "ja", "zh-CN") for the language "${params.languageName}"? Respond with ONLY the language tag itself and nothing else.`;
  try {
    const modelOptions = parseTextModelOptions(params.textModel);
    const client = new OpenAiCompatibleClient(params.apiKey, modelOptions.baseUrl);
    const response = await client.createChatCompletion(
      { model: modelOptions.model, messages: [{ role: "user", content: prompt }] },
      {
        signal: params.signal
          ? AbortSignal.any([params.signal, AbortSignal.timeout(modelOptions.timeoutMs)])
          : AbortSignal.timeout(modelOptions.timeoutMs),
      },
    );
    const languageCode = response.choices?.[0]?.message?.content?.trim().toLowerCase();
    if (languageCode && /^[a-z]{2,3}(-[a-z]{2,4})?$/.test(languageCode)) {
      return languageCode;
    }
    console.warn("[i18n] unusual language code from AI:", languageCode);
    return params.languageName;
  } catch (error) {
    console.warn(
      "[i18n] language code detection failed; using the language name",
      params.languageName,
      error,
    );
    return params.languageName;
  }
}

/**
 * Translates the entire English UI into the target language: sequential
 * chunks of ${CHUNK_SIZE} keys, reporting progress in 0..1 (10% reserved for
 * language-tag detection).
 */
export async function translateUIText(params: {
  apiKey: string;
  textModel: string;
  targetLanguage: string;
  englishTexts: Translation;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}): Promise<{ translation: Translation; languageCode: string }> {
  const keys = Object.keys(params.englishTexts);
  const totalChunks = Math.max(1, Math.ceil(keys.length / CHUNK_SIZE));
  const client = new OpenAiCompatibleClient(
    params.apiKey,
    parseTextModelOptions(params.textModel).baseUrl,
  );
  const progressPerChunk = 0.9 / totalChunks;
  let currentProgress = 0;
  let translatedJson: Translation = {};

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const chunkKeys = keys.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE);
    const englishChunk: Translation = {};
    for (const key of chunkKeys) {
      englishChunk[key] = params.englishTexts[key] ?? "";
    }
    try {
      const translatedChunk = await translateChunk({
        client,
        textModel: params.textModel,
        targetLanguage: params.targetLanguage,
        englishChunk,
        signal: params.signal,
      });
      translatedJson = { ...translatedJson, ...translatedChunk };
      currentProgress += progressPerChunk;
      params.onProgress?.(currentProgress);
    } catch (error) {
      throw new Error(`Translation failed on chunk ${chunkIndex + 1} of ${totalChunks}.`, {
        cause: error,
      });
    }
  }

  const languageCode = await getTranslateLanguageCode({
    apiKey: params.apiKey,
    textModel: params.textModel,
    languageName: params.targetLanguage,
    signal: params.signal,
  });
  params.onProgress?.(1);
  return { translation: translatedJson, languageCode };
}

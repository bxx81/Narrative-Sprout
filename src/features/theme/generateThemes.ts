import { z } from "zod";
import { OpenAiCompatibleClient } from "../../lib/openAiClient";
import { buildSamplingParams, parseTextModelOptions } from "../../lib/modelOptions";
import { GENRES, TONES, WORLDVIEWS } from "./themeGeneratorData";

/** Number of theme ideas produced per generation call (legacy parity). */
const NUM_THEMES_TO_GENERATE = 5;

const generatedThemeSchema = z.object({
  title: z.string(),
  description: z.string(),
});
const themesResponseSchema = z.object({
  themes: z.array(generatedThemeSchema),
});

export interface GeneratedTheme {
  title: string;
  description: string;
  /** Full "Title: description" text placed into the theme textarea. */
  themeText: string;
}

/**
 * Generates random theme ideas (legacy themeService port): 5 keyword sets
 * drawn from worldview/genre/tone lists, one call, output in the narrative
 * language. Rejects with an Error the caller can toast.
 */
export async function generateThemes(params: {
  apiKey: string;
  textModel: string;
  language: string;
  signal?: AbortSignal;
}): Promise<GeneratedTheme[]> {
  const modelOptions = parseTextModelOptions(params.textModel);
  if (!modelOptions.isValid) {
    throw new Error("Model setting is invalid.");
  }

  const getRandomItem = (keywords: string[]): string =>
    keywords[Math.floor(Math.random() * keywords.length)]!;
  const keywordSets = Array.from({ length: NUM_THEMES_TO_GENERATE }, (_, index) => ({
    id: index + 1,
    worldview: getRandomItem(WORLDVIEWS),
    genre: getRandomItem(GENRES),
    tone: getRandomItem(TONES),
  }));

  const prompt = `
Please generate ${NUM_THEMES_TO_GENERATE} unique and inspiring themes for a text adventure game based on the following sets of keywords. For each theme, provide a short, catchy title and an evocative paragraph description (around 20-50 words). The generated themes must be in ${params.language}.

Keyword Sets:
${keywordSets.map((set) => `${set.id}. Worldview: ${set.worldview}, Genre: ${set.genre}, Tone: ${set.tone}`).join("\n")}

You MUST respond in JSON format matching the specified response schema:
{
  "themes": [
    {
      "title": "Theme title",
      "description": "Theme description"
    }
  ]
}
`;
  const responseFormat = modelOptions.strict
    ? {
        type: "json_schema" as const,
        json_schema: {
          name: "themes",
          strict: true,
          schema: z.toJSONSchema(themesResponseSchema) as Record<string, unknown>,
        },
      }
    : {
        type: "json_object" as const,
      };
  const systemFreePrompt = modelOptions.strict
    ? prompt
    : `${prompt}\nRequired JSON schema:\n\`\`\`json\n${JSON.stringify(
        z.toJSONSchema(themesResponseSchema),
        null,
        2,
      )}\n\`\`\`\n`;

  const response = await new OpenAiCompatibleClient(
    params.apiKey,
    modelOptions.baseUrl,
  ).createChatCompletion(
    {
      model: modelOptions.model,
      response_format: responseFormat as never,
      messages: [{ role: "user", content: systemFreePrompt }],
      ...buildSamplingParams(modelOptions),
    },
    {
      signal: params.signal
        ? AbortSignal.any([params.signal, AbortSignal.timeout(modelOptions.timeoutMs)])
        : AbortSignal.timeout(modelOptions.timeoutMs),
    },
  );

  const raw = response.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error("The model may have returned an invalid response.");
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    throw new Error("The model may have returned an invalid response.", { cause: error });
  }
  const parsed = themesResponseSchema.safeParse(parsedJson);
  if (!parsed.success || parsed.data.themes.length === 0) {
    throw new Error("The model may have returned an invalid response.");
  }
  return parsed.data.themes
    .filter((theme) => theme.title.trim().length > 0 && theme.description.trim().length > 0)
    .map((theme) => ({
      title: theme.title.trim(),
      description: theme.description.trim(),
      themeText: `${theme.title.trim()}: ${theme.description.trim()}`,
    }));
}

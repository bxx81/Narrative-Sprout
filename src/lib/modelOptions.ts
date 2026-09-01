/**
 * Per-model options carried on the `textModel` settings string, ported from
 * the legacy model-string syntax. Examples:
 *   openai/gpt-4o-mini
 *   x-ai/grok-4.1-fast --BaseURL=https://example.test/v1 --reasoning=true
 *   provider/model --stream=false --strict=true
 *
 * Defaults: baseUrl = OpenRouter, stream = true, strict = true, maxTokens =
 * 10240, timeoutMs = 600000.
 */

export const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const DEFAULT_MAX_TOKENS = 10 * 1024;
const DEFAULT_TIMEOUT_MS = 600_000;

const reasoningEffortLevels = ["none", "minimal", "low", "medium", "high", "xhigh"] as const;
export type ReasoningEffort = (typeof reasoningEffortLevels)[number];
const REASONING_EFFORT_VALUES: ReadonlySet<string> = new Set(reasoningEffortLevels);

export interface TextModelOptions {
  /** The bare model id ("provider/model") without trailing options. */
  model: string;
  /** OpenAI-compatible endpoint root. */
  baseUrl: string;
  /** Whether SSE streaming may be used for this model. */
  stream: boolean;
  /**
   * Whether the provider enforces the strict json_schema response format.
   * With `--strict=false` the schema is embedded in the prompt instead and
   * the request uses `json_object` (legacy strict flag, default true in v2).
   */
  strict: boolean;
  maxTokens: number;
  timeoutMs: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  repetitionPenalty?: number;
  minP?: number;
  topA?: number;
  /** true/false toggles reasoning; a string sets a specific effort level. */
  reasoning?: boolean | ReasoningEffort;
  reasoningEffort?: string;
  /** vLLM-style thinking toggle sent as chat_template_kwargs. */
  kwargsReasoning?: boolean;
  /** Restrict routing to a single provider (OpenRouter `provider.only`). */
  only?: string;
  /** False when an option was unrecognized or a value failed to parse. */
  isValid: boolean;
}

function parseNumber(value: string): number | undefined {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseInteger(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseTextModelOptions(textModel: string): TextModelOptions {
  const tokens = textModel.trim().split(/\s+/).filter(Boolean);
  const options: TextModelOptions = {
    model: tokens[0] ?? "",
    baseUrl: DEFAULT_OPENROUTER_BASE_URL,
    stream: true,
    strict: true,
    maxTokens: DEFAULT_MAX_TOKENS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    isValid: true,
  };
  if (options.model.length === 0) {
    options.isValid = false;
    return options;
  }

  for (const token of tokens.slice(1)) {
    const separatorIndex = token.indexOf("=");
    if (separatorIndex < 0) {
      options.isValid = false;
      continue;
    }
    const optionName = token.substring(0, separatorIndex).toLowerCase();
    const rawValue = token.substring(separatorIndex + 1);
    switch (optionName) {
      case "--baseurl": {
        if (isHttpUrl(rawValue)) {
          options.baseUrl = rawValue;
        } else {
          options.isValid = false;
        }
        break;
      }
      case "--reasoning": {
        if (rawValue === "true") options.reasoning = true;
        else if (rawValue === "false") options.reasoning = false;
        else if (REASONING_EFFORT_VALUES.has(rawValue)) {
          options.reasoning = rawValue as "low";
        } else options.isValid = false;
        break;
      }
      case "--reasoning_effort": {
        if (rawValue.length > 0) options.reasoningEffort = rawValue;
        else options.isValid = false;
        break;
      }
      case "--temperature":
        options.temperature = parseNumber(rawValue);
        if (options.temperature === undefined) options.isValid = false;
        break;
      case "--top_p":
        options.topP = parseNumber(rawValue);
        if (options.topP === undefined) options.isValid = false;
        break;
      case "--top_k":
        options.topK = parseNumber(rawValue);
        if (options.topK === undefined) options.isValid = false;
        break;
      case "--frequency_penalty":
        options.frequencyPenalty = parseNumber(rawValue);
        if (options.frequencyPenalty === undefined) options.isValid = false;
        break;
      case "--presence_penalty":
        options.presencePenalty = parseNumber(rawValue);
        if (options.presencePenalty === undefined) options.isValid = false;
        break;
      case "--repetition_penalty":
        options.repetitionPenalty = parseNumber(rawValue);
        if (options.repetitionPenalty === undefined) options.isValid = false;
        break;
      case "--min_p":
        options.minP = parseNumber(rawValue);
        if (options.minP === undefined) options.isValid = false;
        break;
      case "--top_a":
        options.topA = parseNumber(rawValue);
        if (options.topA === undefined) options.isValid = false;
        break;
      case "--max_tokens":
        options.maxTokens = parseInteger(rawValue) ?? DEFAULT_MAX_TOKENS;
        if (parseInteger(rawValue) === undefined) options.isValid = false;
        break;
      case "--timeout":
        options.timeoutMs = parseInteger(rawValue) ?? DEFAULT_TIMEOUT_MS;
        if (parseInteger(rawValue) === undefined) options.isValid = false;
        break;
      case "--kwargs_reasoning": {
        if (rawValue === "true") options.kwargsReasoning = true;
        else if (rawValue === "false") options.kwargsReasoning = false;
        else options.isValid = false;
        break;
      }
      case "--only": {
        if (rawValue.length > 0) options.only = rawValue;
        else options.isValid = false;
        break;
      }
      case "--strict": {
        if (rawValue === "true") options.strict = true;
        else if (rawValue === "false") options.strict = false;
        else options.isValid = false;
        break;
      }
      case "--stream": {
        if (rawValue === "true") options.stream = true;
        else if (rawValue === "false") options.stream = false;
        else options.isValid = false;
        break;
      }
      default:
        options.isValid = false;
        break;
    }
  }
  return options;
}

/**
 * Body parameters derived from the model options (legacy `getParams`):
 * sampling knobs, token limit, reasoning routing and provider pinning.
 */
export function buildSamplingParams(options: TextModelOptions): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (options.temperature !== undefined) params.temperature = options.temperature;
  if (options.topP !== undefined) params.top_p = options.topP;
  if (options.topK !== undefined) params.top_k = options.topK;
  if (options.frequencyPenalty !== undefined) params.frequency_penalty = options.frequencyPenalty;
  if (options.presencePenalty !== undefined) params.presence_penalty = options.presencePenalty;
  if (options.repetitionPenalty !== undefined)
    params.repetition_penalty = options.repetitionPenalty;
  if (options.minP !== undefined) params.min_p = options.minP;
  if (options.topA !== undefined) params.top_a = options.topA;
  if (options.maxTokens !== undefined) params.max_completion_tokens = options.maxTokens;
  if (options.reasoning !== undefined) {
    params.reasoning = { effort: options.reasoning === true ? "true" : String(options.reasoning) };
  }
  if (options.reasoningEffort !== undefined) params.reasoning_effort = options.reasoningEffort;
  if (options.kwargsReasoning !== undefined) {
    params.chat_template_kwargs = { enable_thinking: options.kwargsReasoning };
  }
  if (options.only !== undefined) params.provider = { only: [options.only] };
  return params;
}

/** Streaming decision: the global setting AND the per-model opt-out. */
export function isStreamingEnabledForSettings(settings: {
  enableStreaming: boolean;
  textModel: string;
}): boolean {
  if (!settings.enableStreaming) return false;
  return parseTextModelOptions(settings.textModel).stream;
}

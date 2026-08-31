/**
 * Minimal OpenAI-compatible chat completions client (OpenRouter default).
 * Non-streaming for now; SSE streaming arrives in a later phase (REDESIGN §8).
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  response_format?: {
    type: "json_schema";
    json_schema: { name: string; schema: Record<string, unknown>; strict?: boolean };
  };
  temperature?: number;
  max_completion_tokens?: number;
  [key: string]: unknown;
}

export interface ChatCompletionResponse {
  model?: string;
  choices?: {
    message?: { content?: string | null; reasoning?: string | null };
    finish_reason?: string;
  }[];
  usage?: { total_tokens?: number; cost?: number };
  error?: { code?: string | number; message?: string };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly displayMessage: string,
  ) {
    super(displayMessage);
    this.name = "ApiError";
  }
}

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

function parseErrorMessage(rawBody: string, fallback: string): string {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object") {
      const message = (parsed as { error?: { message?: unknown } }).error?.message;
      if (typeof message === "string" && message.length > 0) return message;
    }
  } catch {
    // fall through: body was not JSON
  }
  return rawBody || fallback;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class OpenAiCompatibleClient {
  constructor(
    private readonly apiKey: string | null,
    private readonly baseUrl = "https://openrouter.ai/api/v1",
    private readonly maxRetries = 2,
  ) {}

  async createChatCompletion(
    body: ChatCompletionRequest,
    options?: { signal?: AbortSignal },
  ): Promise<ChatCompletionResponse> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: options?.signal,
        });
      } catch (error) {
        lastError = error;
        if (options?.signal?.aborted) throw error;
        if (attempt === this.maxRetries) throw error;
        await sleep(500 * 2 ** attempt + Math.random() * 250);
        continue;
      }

      if (response.ok) {
        return (await response.json()) as ChatCompletionResponse;
      }
      const rawBody = await response.text().catch(() => "");
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === this.maxRetries) {
        throw new ApiError(response.status, parseErrorMessage(rawBody, response.statusText));
      }
      await sleep(500 * 2 ** attempt + Math.random() * 250);
    }
    throw lastError instanceof Error ? lastError : new Error("Request failed");
  }
}

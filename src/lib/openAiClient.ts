/**
 * Minimal OpenAI-compatible chat completions client (OpenRouter default).
 * Supports both bulk and SSE streaming delivery (REDESIGN §8).
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

export interface StreamingCompletionOptions {
  signal?: AbortSignal;
  /** Receives the ACCUMULATED content each time a delta arrives. */
  onDelta?: (accumulatedText: string) => void;
  /** Max silence between chunks once content streaming started (default 60s). */
  idleTimeoutMs?: number;
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

  /**
   * Streaming variant of `createChatCompletion`: sends `stream: true` with
   * usage inclusion, consumes the SSE stream by hand and forwards the
   * accumulated content to `onDelta` (legacy `createStream` contract).
   * Assembles a normal-shaped completion response at the end so downstream
   * parsing is identical for both delivery modes. A non-event-stream
   * response (provider ignored `stream`) is read as plain JSON.
   */
  async createStreamingChatCompletion(
    body: ChatCompletionRequest,
    options?: StreamingCompletionOptions,
  ): Promise<ChatCompletionResponse> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;
    const requestBody = { ...body, stream: true, stream_options: { include_usage: true } };

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
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
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/event-stream")) {
          return (await response.json()) as ChatCompletionResponse;
        }
        return await consumeSSEResponse(response, options);
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

interface SSEChatCompletionChunk {
  model?: string;
  choices?: {
    delta?: { content?: string | null; reasoning?: string | null; finish_reason?: string | null };
    finish_reason?: string | null;
  }[];
  usage?: { total_tokens?: number; cost?: number };
  error?: { code?: string | number; message?: string };
}

/**
 * Reads an SSE chat-completions response: accumulates `delta.content` (and
 * `delta.reasoning` separately), captures model/usage/finish_reason, and
 * assembles a normal completion response (legacy consumeSSEResponse). The
 * idle timeout arms per chunk only AFTER content streaming starts — one-shot
 * models have a long silent gap between reasoning and body.
 */
async function consumeSSEResponse(
  response: Response,
  options?: StreamingCompletionOptions,
): Promise<ChatCompletionResponse> {
  const idleTimeoutMs = options?.idleTimeoutMs ?? 60_000;
  const readerOrNull = response.body?.getReader();
  if (!readerOrNull) throw new Error("Streaming response has no body.");
  const reader: ReadableStreamDefaultReader<Uint8Array> = readerOrNull;

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoning = "";
  let model: string | undefined;
  let usage: ChatCompletionResponse["usage"];
  let finishReason: string | null = null;
  let streamError: { code?: string | number; message?: string } | null = null;
  const setStreamError = (error: { code?: string | number; message?: string }): void => {
    streamError = error;
  };
  const reportedStreamError = () => streamError;
  let contentStreamingStarted = false;

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let idleReject: ((error: Error) => void) | null = null;
  const idlePromise = new Promise<never>((_resolve, reject) => {
    idleReject = reject;
  });
  idlePromise.catch(() => {}); // avoid unhandled rejection when nobody races

  function clearIdleTimer(): void {
    if (idleTimer != null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function armIdleTimer(): void {
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      idleTimer = null;
      void reader.cancel().catch(() => {});
      idleReject?.(new DOMException(`No SSE chunk for ${idleTimeoutMs}ms`, "TimeoutError"));
    }, idleTimeoutMs);
  }

  type ChunkReadResult = Awaited<ReturnType<ReadableStreamDefaultReader<Uint8Array>["read"]>>;

  function handleEventBlock(eventBlock: string): { done: boolean } {
    for (const rawLine of eventBlock.split("\n")) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice("data:".length).trim();
      if (payload === "[DONE]") return { done: true };
      let chunk: SSEChatCompletionChunk;
      try {
        chunk = JSON.parse(payload) as SSEChatCompletionChunk;
      } catch {
        continue; // keep-alive or malformed line: skip
      }
      if (chunk.error) setStreamError(chunk.error);
      if (typeof chunk.model === "string") model = chunk.model;
      if (chunk.usage) usage = chunk.usage;
      const choice = chunk.choices?.[0];
      const finish = choice?.delta?.finish_reason ?? choice?.finish_reason ?? null;
      if (finish != null) finishReason = finish;
      const delta = choice?.delta;
      if (typeof delta?.reasoning === "string" && delta.reasoning.length > 0) {
        reasoning += delta.reasoning;
      }
      if (typeof delta?.content === "string" && delta.content.length > 0) {
        content += delta.content;
        contentStreamingStarted = true;
        options?.onDelta?.(content);
      }
    }
    return { done: false };
  }

  function assembleResponse(): ChatCompletionResponse {
    return {
      model,
      choices: [{ message: { content, reasoning }, finish_reason: finishReason ?? undefined }],
      usage,
    };
  }

  try {
    for (;;) {
      let readResult: ChunkReadResult;
      if (contentStreamingStarted) {
        armIdleTimer();
        readResult = await Promise.race([reader.read(), idlePromise]);
        clearIdleTimer();
      } else {
        readResult = await reader.read();
      }
      if (readResult.done) break;
      buffer += decoder.decode(readResult.value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundaryIndex = buffer.indexOf("\n\n");
      while (boundaryIndex !== -1) {
        const eventBlock = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);
        const { done } = handleEventBlock(eventBlock);
        if (done) return assembleResponse();
        boundaryIndex = buffer.indexOf("\n\n");
      }
    }
  } finally {
    clearIdleTimer();
  }

  const reportedError = reportedStreamError();
  if (reportedError) {
    throw new ApiError(500, reportedError.message ?? "LLM stream reported an error.");
  }
  return assembleResponse();
}

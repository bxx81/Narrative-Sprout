import type { GenerateParams, IImageGenerator, ImageGenConfig } from "../types";
import { REPLACE_WORD, NEGATIVE_REPLACE_WORD } from "../types";
import { parseJsonConfig, escapePromptWeights } from "./utils";

const PROGRESS_POLL_INTERVAL_MS = 500;
const REQUEST_TIMEOUT_MS = 600_000;

const DEFAULT_CONFIG = {
  steps: 25,
  width: 1024,
  height: 1024,
  cfg_scale: 5,
  sampler_name: "DPM++ 2M",
  scheduler: "Karras",
  prompt: "masterpiece, best quality, general",
  negative_prompt: "worst quality, low quality",
} as const;

interface A1111Response {
  images?: string[];
}
interface A1111ProgressResponse {
  progress: number;
}

export class A1111ImageGenerator implements IImageGenerator {
  private _lastProgress = 0;

  async unloadModel(config: ImageGenConfig): Promise<void> {
    const response = await fetch(`${config.a1111Endpoint}/sdapi/v1/unload-checkpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`AUTOMATIC1111 unload API error: ${response.status} ${response.statusText}`);
    }
    return;
  }

  async generate(params: GenerateParams): Promise<string> {
    const { prompt, negativePrompt, config, onProgress, signal } = params;
    this._lastProgress = 0;
    const { a1111Endpoint, a1111Config } = config;
    if (a1111Endpoint.length === 0) throw new Error("Empty endpoint.");
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const userConfig = parseJsonConfig<Record<string, string | number | boolean>>(
      a1111Config,
      "A1111",
    );
    const payload = this.buildPayload(prompt, negativePrompt, userConfig);

    const abortController = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pollLoop = async () => {
      while (!abortController.signal.aborted) {
        await this.pollProgress(a1111Endpoint, onProgress);
        await new Promise<void>((resolve) => {
          timer = setTimeout(resolve, PROGRESS_POLL_INTERVAL_MS);
        });
      }
    };
    void pollLoop();

    try {
      const image = await this.requestImage(a1111Endpoint, payload, signal);
      return image;
    } catch (error) {
      abortController.abort();
      if (timer) clearTimeout(timer);
      throw this.wrapError(error, a1111Endpoint);
    } finally {
      abortController.abort();
      if (timer) clearTimeout(timer);
      onProgress(1);
    }
  }

  private buildPayload(
    prompt: string | undefined,
    negativePrompt: string | undefined,
    userConfig: Partial<Record<string, string | number | boolean>>,
  ): Record<string, unknown> {
    const base = { ...DEFAULT_CONFIG, ...userConfig } as Record<string, unknown> &
      typeof DEFAULT_CONFIG;
    const escapedPrompt = escapePromptWeights(prompt ?? "").replace(
      /(?<![A-Za-z'])AND(?![A-Za-z'])/g,
      ", ",
    );
    const escapedNegativePrompt = escapePromptWeights(negativePrompt ?? "");
    let finalPrompt = (base.prompt as string).includes(REPLACE_WORD)
      ? (base.prompt as string).replaceAll(REPLACE_WORD, escapedPrompt)
      : [escapedPrompt, base.prompt].filter(Boolean).join(", ");
    if (finalPrompt.includes(NEGATIVE_REPLACE_WORD)) {
      finalPrompt = finalPrompt.replaceAll(NEGATIVE_REPLACE_WORD, escapedNegativePrompt);
    }
    const finalNegativePrompt = (base.negative_prompt as string).includes(REPLACE_WORD)
      ? (base.negative_prompt as string).replace(REPLACE_WORD, escapedNegativePrompt)
      : [escapedNegativePrompt, base.negative_prompt].filter(Boolean).join(", ");
    return { ...base, prompt: finalPrompt, negative_prompt: finalNegativePrompt };
  }

  private async requestImage(
    endpoint: string,
    payload: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<string> {
    const signals: AbortSignal[] = [AbortSignal.timeout(REQUEST_TIMEOUT_MS)];
    if (signal) signals.push(signal);
    const response = await fetch(`${endpoint}/sdapi/v1/txt2img`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.any(signals),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Could not read error response.");
      throw new Error(
        `AUTOMATIC1111 API error: ${response.status} ${response.statusText}. Response: ${errorText}.`,
      );
    }
    const data = (await response.json()) as A1111Response;
    if (!data.images?.length) throw new Error("AUTOMATIC1111 API returned no images.");
    return `data:image/png;base64,${data.images[0]}`;
  }

  private async pollProgress(endpoint: string, onProgress: (p: number) => void): Promise<void> {
    try {
      const response = await fetch(`${endpoint}/sdapi/v1/progress?skip_current_image=true`);
      if (!response.ok) return;
      const data = (await response.json()) as A1111ProgressResponse;
      if (data.progress > this._lastProgress) {
        this._lastProgress = data.progress;
        onProgress(data.progress);
      }
    } catch {
      // best-effort
    }
  }

  private wrapError(error: unknown, endpoint: string): Error {
    if (
      error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      return new Error(`AUTOMATIC1111 request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`);
    }
    if (error instanceof TypeError) {
      return new Error(`Network error connecting to AUTOMATIC1111 at ${endpoint}.`);
    }
    if (error instanceof Error) return error;
    return new Error("Unknown error contacting AUTOMATIC1111 API.");
  }
}

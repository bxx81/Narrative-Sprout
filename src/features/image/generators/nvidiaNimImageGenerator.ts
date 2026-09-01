import type { GenerateParams, IImageGenerator } from "../types";
import { REPLACE_WORD } from "../types";
import { parseJsonConfig } from "./utils";

interface NvcfImageResponse {
  artifacts?: { base64?: string }[];
}

const REQUEST_TIMEOUT_MS = 300_000;
const DEFAULT_CONFIG = { seed: 0, steps: 4, width: 1024, height: 1024 } as const;

export class NvidiaNimImageGenerator implements IImageGenerator {
  async unloadModel(): Promise<void> {
    return;
  }

  async generate(params: GenerateParams): Promise<string> {
    const { prompt, config, onProgress, signal } = params;
    // NIM API does not support negativePrompt; the field is accepted by the
    // interface for uniformity but intentionally ignored here.
    void params.negativePrompt;
    const { nimEndpoint, nimToken, nimConfig } = config;
    if (!nimEndpoint) throw new Error("NVIDIA NIM endpoint is not configured.");
    const userConfig = parseJsonConfig<Record<string, string | number | boolean>>(
      nimConfig,
      "NVIDIA NIM",
    );
    const payload = this.buildPayload(prompt, userConfig);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (nimToken) headers["Authorization"] = `Bearer ${nimToken}`;
    const signals: AbortSignal[] = [AbortSignal.timeout(REQUEST_TIMEOUT_MS)];
    if (signal) signals.push(signal);
    let response: Response;
    try {
      response = await fetch(nimEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.any(signals),
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new Error(`NVIDIA NIM request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`, {
          cause: error,
        });
      }
      throw error;
    }
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `NVIDIA NIM API error: ${response.status} ${response.statusText}.` +
          (errorText ? ` Response: ${errorText}` : ""),
      );
    }
    const data = (await response.json()) as NvcfImageResponse;
    const base64 = data.artifacts?.[0]?.base64;
    if (!base64) throw new Error("NVIDIA NIM API returned no image data.");
    onProgress(1);
    return `data:image/jpeg;base64,${base64}`;
  }

  private buildPayload(
    prompt: string | undefined,
    userConfig: Partial<Record<string, string | number | boolean>>,
  ): Record<string, unknown> {
    const base = { ...DEFAULT_CONFIG, ...userConfig } as Record<string, unknown>;
    const userPrompt = base["prompt"];
    const finalPrompt =
      typeof userPrompt === "string" && (userPrompt as string).includes(REPLACE_WORD)
        ? (userPrompt as string).replaceAll(REPLACE_WORD, prompt ?? "")
        : [prompt, userPrompt].filter(Boolean).join(", ");
    return { ...base, prompt: finalPrompt };
  }
}

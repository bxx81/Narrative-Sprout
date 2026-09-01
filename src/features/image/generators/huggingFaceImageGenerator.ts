import type { GenerateParams, IImageGenerator } from "../types";
import { REPLACE_WORD } from "../types";
import { blobToDataUrl, escapePromptWeights, parseJsonConfig } from "./utils";

const DEFAULT_API_NAME = "/infer";
const DELETE_SENTINEL = "delete";
const DEFAULT_CONFIG = {
  seed: 0,
  randomize_seed: true,
  width: 1024,
  height: 1024,
  num_inference_steps: 9,
  prompt: "best quality",
  negative_prompt: "delete",
  apiname: "/generate_image",
} as const;
const MAX_SIGNED_INT32 = 0x7fffffff;
const GENERATION_TIMEOUT_MS = 600_000;

interface HuggingFacePayload {
  [key: string]: string | number | boolean | undefined;
  prompt: string;
  seed: number;
  num_inference_steps: number;
  negative_prompt?: string;
}
interface GradioResult {
  data: (string | { url: string })[];
}

export function findFirstUrl(data: unknown): string | undefined {
  if (Array.isArray(data)) {
    for (const item of data) {
      const result = findFirstUrl(item);
      if (result) return result;
    }
  } else if (data !== null && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if ("url" in obj && typeof obj.url === "string") return obj.url;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const result = findFirstUrl(obj[key]);
        if (result) return result;
      }
    }
  }
  return undefined;
}

export class HuggingFaceImageGenerator implements IImageGenerator {
  async unloadModel(): Promise<void> {
    return;
  }

  async generate(params: GenerateParams): Promise<string> {
    const { prompt, negativePrompt, config } = params;
    const { huggingFaceConfig, huggingFaceToken, huggingFaceSpaceId } = config;
    if (!huggingFaceSpaceId) throw new Error("Hugging Face Space ID is not configured.");
    const userConfig = parseJsonConfig<Record<string, string | number | boolean>>(
      huggingFaceConfig,
      "HuggingFace",
    );
    const { apiName, payload } = this.buildPayload(prompt ?? "", negativePrompt, userConfig);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () =>
          reject(
            new Error(`HuggingFace generation timed out after ${GENERATION_TIMEOUT_MS / 1000}s.`),
          ),
        GENERATION_TIMEOUT_MS,
      );
    });
    try {
      const imageUrl = await Promise.race([
        this.predictAndFetch(apiName, payload, huggingFaceSpaceId, huggingFaceToken),
        timeoutPromise,
      ]);
      return imageUrl;
    } catch (error) {
      throw this.wrapError(error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async predictAndFetch(
    apiName: string,
    payload: HuggingFacePayload,
    spaceId: string,
    token: string | null | undefined,
  ): Promise<string> {
    const client = await this.connectClient(spaceId, token);
    const result = await client.predict(apiName, payload);
    const imageUrl = this.extractImageUrl(result as GradioResult);
    if (!imageUrl) throw new Error("HuggingFace API returned no image or an invalid format.");
    if (imageUrl.startsWith("data:image")) return imageUrl;
    const fullUrl = new URL(imageUrl, client.config?.root).href;
    return this.fetchImageAsDataUrl(fullUrl);
  }

  private buildPayload(
    prompt: string,
    negativePrompt: string | undefined,
    userConfig: Partial<Record<string, string | number | boolean>>,
  ): { apiName: string; payload: HuggingFacePayload } {
    const base = { ...DEFAULT_CONFIG, ...userConfig } as Record<string, unknown> &
      typeof DEFAULT_CONFIG;
    const escapedPrompt = escapePromptWeights(prompt ?? "");
    const escapedNegativePrompt = escapePromptWeights(negativePrompt ?? "");
    const finalPrompt = (base.prompt as string).includes(REPLACE_WORD)
      ? (base.prompt as string).replaceAll(REPLACE_WORD, escapedPrompt)
      : [escapedPrompt, base.prompt].filter(Boolean).join(", ");
    const finalNegativePrompt = (base.negative_prompt as string).includes(REPLACE_WORD)
      ? (base.negative_prompt as string).replace(REPLACE_WORD, escapedNegativePrompt)
      : [escapedNegativePrompt, base.negative_prompt].filter(Boolean).join(", ");
    const payload: HuggingFacePayload = {
      ...(base as unknown as HuggingFacePayload),
      prompt: finalPrompt,
      negative_prompt: finalNegativePrompt,
    };
    if (payload.seed === 0) payload.seed = Math.floor(Math.random() * MAX_SIGNED_INT32);
    for (const [key, value] of Object.entries(userConfig)) {
      if (value === DELETE_SENTINEL) delete payload[key];
    }
    const apiName =
      typeof payload?.apiname === "string" && (payload.apiname as string).trim()
        ? (payload.apiname as string).trim()
        : DEFAULT_API_NAME;
    delete payload.apiname;
    return { apiName, payload };
  }

  private async connectClient(spaceId: string, token: string | null | undefined) {
    const trimmed = token?.trim();
    const { Client } = await import("@gradio/client");
    return Client.connect(
      spaceId,
      trimmed ? { token: trimmed as `hf_${string}` } : undefined,
    ) as Promise<{
      predict: (apiName: string, payload: unknown) => Promise<unknown>;
      config?: { root?: string };
    }>;
  }

  private extractImageUrl(result: GradioResult): string | null {
    const firstUrl = findFirstUrl(result);
    return firstUrl ?? null;
  }

  private async fetchImageAsDataUrl(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(
        `Failed to fetch image from HuggingFace URL (${url}): ${response.status} ${response.statusText}`,
      );
    const blob = await response.blob();
    return blobToDataUrl(blob);
  }

  private wrapError(error: unknown): Error {
    if (error instanceof TypeError)
      return new Error("Network error connecting to the HuggingFace API.");
    if (error instanceof Error) return new Error(`HuggingFace API error: ${error.message}.`);
    return new Error("Unknown error contacting the HuggingFace API.");
  }
}

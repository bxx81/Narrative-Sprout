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
const GRADIO_FILE_URL_PREFIX = "/gradio_api";
const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|webp|gif|bmp|avif)([?#]|$)/i;

interface HuggingFacePayload {
  [key: string]: string | number | boolean | undefined;
  prompt: string;
  seed: number;
  num_inference_steps: number;
  negative_prompt?: string;
}

interface GradioParameterInfo {
  label?: string;
  parameter_name?: string | null;
  parameter_default?: unknown;
  parameter_has_default?: boolean;
  component?: string;
}
interface GradioEndpointInfo {
  parameters?: GradioParameterInfo[];
  returns?: GradioParameterInfo[];
}
interface GradioApiInfo {
  named_endpoints?: Record<string, GradioEndpointInfo>;
}
interface GradioResult {
  data?: unknown;
}
interface GradioSpaceConfig {
  root?: string;
  api_prefix?: string;
}
interface GradioClient {
  predict: (endpoint: string | number, payload: unknown[]) => Promise<unknown>;
  view_api: () => Promise<GradioApiInfo>;
  api_info?: GradioApiInfo;
  config?: GradioSpaceConfig;
}
interface ResolvedEndpoint {
  name: string;
  info: GradioEndpointInfo;
}

function detectImageMimeType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
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
    const apiInfo = client.api_info ?? (await client.view_api());
    const endpoint = this.resolveEndpoint(apiInfo, apiName);
    const args = this.buildArguments(endpoint.name, endpoint.info, payload);
    const result = (await client.predict(endpoint.name, args)) as GradioResult;
    const imageUrl = this.extractImageUrl(result, endpoint.info, client.config);
    if (!imageUrl) throw new Error("HuggingFace API returned no image or an invalid format.");
    if (imageUrl.startsWith("data:image")) return imageUrl;
    return this.fetchImageAsDataUrl(imageUrl);
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
    ) as Promise<GradioClient>;
  }

  private resolveEndpoint(apiInfo: GradioApiInfo, requestedApiName: string): ResolvedEndpoint {
    const namedEndpoints = apiInfo.named_endpoints ?? {};
    const requested = namedEndpoints[requestedApiName];
    if (requested) return { name: requestedApiName, info: requested };
    const imageEndpoints = Object.entries(namedEndpoints).filter(([, info]) =>
      (info.returns ?? []).some((entry) => entry.component === "Image"),
    );
    if (imageEndpoints.length === 0) {
      const available = Object.keys(namedEndpoints);
      throw new Error(
        `HuggingFace Space exposes no image endpoint (requested "${requestedApiName}"). Available endpoints: ${
          available.length > 0 ? available.join(", ") : "none"
        }.`,
      );
    }
    const fallback =
      imageEndpoints.find(([name]) => name === DEFAULT_API_NAME) ??
      imageEndpoints.find(([name]) => /(infer|generate|predict)/i.test(name)) ??
      imageEndpoints[0];
    console.warn(
      `HuggingFace endpoint "${requestedApiName}" was not found; using "${fallback[0]}" instead.`,
    );
    return { name: fallback[0], info: fallback[1] };
  }

  private buildArguments(
    endpointName: string,
    endpointInfo: GradioEndpointInfo,
    payload: HuggingFacePayload,
  ): unknown[] {
    const parameters = endpointInfo.parameters ?? [];
    const provided: Record<string, unknown> = { ...payload };
    const acceptedNames = new Set(
      parameters
        .map((parameter) => parameter.parameter_name)
        .filter((name): name is string => typeof name === "string" && name.length > 0),
    );
    const unsupported = Object.keys(provided).filter((key) => !acceptedNames.has(key));
    if (unsupported.length > 0) {
      console.warn(
        `HuggingFace endpoint "${endpointName}" ignores unsupported parameters: ${unsupported.join(", ")}.`,
      );
      for (const key of unsupported) delete provided[key];
    }
    return parameters.map((parameter) => {
      const name = parameter.parameter_name;
      if (name && provided[name] !== undefined) return provided[name];
      if (parameter.parameter_has_default) return parameter.parameter_default;
      throw new Error(
        `HuggingFace endpoint "${endpointName}" requires "${
          name ?? parameter.label ?? "unnamed"
        }" which the config does not provide.`,
      );
    });
  }

  private extractImageUrl(
    result: GradioResult,
    endpointInfo: GradioEndpointInfo,
    config?: GradioSpaceConfig,
  ): string | null {
    const data = Array.isArray(result?.data) ? result.data : [];
    const imageIndex = (endpointInfo.returns ?? []).findIndex(
      (entry) => entry.component === "Image",
    );
    if (imageIndex >= 0 && imageIndex < data.length) {
      const direct = this.toImageUrl(data[imageIndex], config);
      if (direct) return direct;
    }
    return this.findImageUrlDeep(data, config);
  }

  private findImageUrlDeep(value: unknown, config?: GradioSpaceConfig): string | null {
    if (Array.isArray(value)) {
      for (const item of value) {
        const url = this.findImageUrlDeep(item, config);
        if (url) return url;
      }
      return null;
    }
    if (typeof value === "string") {
      const url = this.toImageUrl(value, config);
      return url && this.isPlausibleImageUrl(url) ? url : null;
    }
    if (value !== null && typeof value === "object") {
      const direct = this.toImageUrl(value, config);
      if (direct && this.isPlausibleImageUrl(direct)) return direct;
      for (const nested of Object.values(value as Record<string, unknown>)) {
        const url = this.findImageUrlDeep(nested, config);
        if (url) return url;
      }
    }
    return null;
  }

  private isPlausibleImageUrl(value: string): boolean {
    if (value.startsWith("data:image/")) return true;
    const path = value.replace(/^https?:\/\/[^/?#]+/i, "");
    return IMAGE_EXTENSION_PATTERN.test(path);
  }

  private toImageUrl(value: unknown, config?: GradioSpaceConfig): string | null {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.startsWith("data:image/")) return trimmed;
      if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
        return this.resolveUrl(trimmed, config);
      }
      return null;
    }
    if (value !== null && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.url === "string" && record.url.length > 0) {
        return this.toImageUrl(record.url, config);
      }
      if (typeof record.path === "string" && record.path.length > 0) {
        if (record.path.startsWith("/")) {
          const fileUrl = `${config?.api_prefix ?? GRADIO_FILE_URL_PREFIX}/file=${record.path}`;
          return this.resolveUrl(fileUrl, config);
        }
        return this.toImageUrl(record.path, config);
      }
    }
    return null;
  }

  private resolveUrl(url: string, config?: GradioSpaceConfig): string {
    if (/^https?:\/\//i.test(url)) return url;
    const root = config?.root;
    if (!root) {
      throw new Error(
        `Cannot resolve the relative HuggingFace image URL "${url}" without the Space root.`,
      );
    }
    try {
      return new URL(url, root).href;
    } catch {
      throw new Error(
        `Cannot resolve the relative HuggingFace image URL "${url}" against "${root}".`,
      );
    }
  }

  private async fetchImageAsDataUrl(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(
        `Failed to fetch image from HuggingFace URL (${url}): ${response.status} ${response.statusText}`,
      );
    const headerType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const bytes = new Uint8Array(await response.arrayBuffer());
    const mimeType =
      detectImageMimeType(bytes) ?? (headerType.startsWith("image/") ? headerType : null);
    if (!mimeType) {
      throw new Error(
        `HuggingFace image URL (${url}) returned "${headerType || "unknown content"}" instead of an image.`,
      );
    }
    return blobToDataUrl(new Blob([bytes], { type: mimeType }));
  }

  private wrapError(error: unknown): Error {
    if (error instanceof TypeError)
      return new Error("Network error connecting to the HuggingFace API.");
    if (error instanceof Error) return new Error(`HuggingFace API error: ${error.message}.`);
    return new Error("Unknown error contacting the HuggingFace API.");
  }
}

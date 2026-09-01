import type { ImageGeneratorType } from "../../types/settings";

export const REPLACE_WORD = "{prompt}";
export const NEGATIVE_REPLACE_WORD = "{negative_prompt}";

export interface ImageGenConfig {
  generator: ImageGeneratorType;
  a1111Endpoint: string;
  a1111Config: string;
  comfyuiEndpoint: string;
  comfyuiWorkflow: string;
  huggingFaceConfig: string;
  huggingFaceSpaceId: string;
  huggingFaceToken: string | null;
  nimEndpoint: string;
  nimConfig: string;
  nimToken: string | null;
}

export interface GenerateParams {
  prompt: string | undefined;
  negativePrompt: string | undefined;
  config: ImageGenConfig;
  onProgress: (progress: number) => void;
  signal?: AbortSignal;
}

export interface IImageGenerator {
  generate(params: GenerateParams): Promise<string>;
  unloadModel?(config: ImageGenConfig): Promise<void>;
}

export const FALLBACK_IMAGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#1f2937"/><g style="font-family: Inter, sans-serif; text-anchor: middle; dominant-baseline: middle;"><g transform="translate(0 -40)"><path d="M487,487 L537,537 M537,487 L487,537" stroke="#9ca3af" stroke-width="12" stroke-linecap="round"/><text x="512" y="620" font-size="40" fill="#e5e7eb" font-weight="bold">Image Generation Failed</text><text x="512" y="670" font-size="28" fill="#d1d5db">Click the regenerate button to try again</text></g></g></svg>`;
export const TRANSPARENT_IMAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="100%" height="100%" fill="#ffffff00"/></svg>';

export const FALLBACK_IMAGE_URL = `data:image/svg+xml;base64,${typeof window !== "undefined" ? btoa(FALLBACK_IMAGE_SVG) : ""}`;
export const TRANSPARENT_IMAGE_URL = `data:image/svg+xml;base64,${typeof window !== "undefined" ? btoa(TRANSPARENT_IMAGE_SVG) : ""}`;

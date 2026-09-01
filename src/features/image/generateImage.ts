import { ImageGeneratorFactory } from "./imageGeneratorFactory";
import type { ImageGenConfig } from "./types";
import { FALLBACK_IMAGE_URL } from "./types";

/**
 * High-level scene image generation (REDESIGN.md §5.3).
 *
 * Wraps the generator factory with fallback handling and abort racing.
 * Returns a `data:` URL (the generator contract). Callers are responsible for
 * converting to Blob / WebP and persisting as an `AssetRecord`.
 */
export async function generateSceneImage(params: {
  imagePrompt: string;
  negativeImagePrompt: string;
  imageGenConfig: ImageGenConfig;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
  useFallback?: boolean;
}): Promise<string> {
  const {
    imagePrompt,
    negativeImagePrompt,
    imageGenConfig,
    onProgress,
    signal,
    useFallback = true,
  } = params;
  const generator = ImageGeneratorFactory.create(imageGenConfig.generator);

  const generateParams = {
    prompt: imagePrompt ?? "",
    negativePrompt: negativeImagePrompt ?? "",
    config: imageGenConfig,
    onProgress: onProgress ?? (() => {}),
    signal,
  };

  try {
    if (signal) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const abortPromise = new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
          once: true,
        });
      });
      return await Promise.race([generator.generate(generateParams), abortPromise]);
    }
    return await generator.generate(generateParams);
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError") ||
      signal?.aborted
    ) {
      throw error;
    }
    console.error(`Error generating image with ${imageGenConfig.generator}:`, error);
    if (!useFallback) throw error;
    return FALLBACK_IMAGE_URL;
  }
}

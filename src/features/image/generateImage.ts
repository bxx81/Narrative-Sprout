import { ImageGeneratorFactory } from "./imageGeneratorFactory";
import type { ImageGenConfig } from "./types";

/**
 * High-level scene image generation (knowledge/features/image-generation.md).
 *
 * Wraps the generator factory with abort racing. Returns a `data:` URL (the
 * generator contract). Callers are responsible for converting to Blob / WebP
 * and persisting as an `AssetRecord`.
 *
 * Non-abort failures are rethrown instead of being swapped for a placeholder:
 * the turn flow persists no asset in that case, which is exactly the
 * "generator disabled" behaviour (transparent placeholder on the game screen,
 * "not available" on the card screens). The caller decides how to report the
 * failure (toast for in-turn failures, error dialog for regeneration).
 */
export async function generateSceneImage(params: {
  imagePrompt: string;
  negativeImagePrompt: string;
  imageGenConfig: ImageGenConfig;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const { imagePrompt, negativeImagePrompt, imageGenConfig, onProgress, signal } = params;
  const generator = ImageGeneratorFactory.create(imageGenConfig.generator);

  const generateParams = {
    prompt: imagePrompt ?? "",
    negativePrompt: negativeImagePrompt ?? "",
    config: imageGenConfig,
    onProgress: onProgress ?? (() => {}),
    signal,
  };

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
}

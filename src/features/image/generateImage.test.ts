import { describe, expect, test } from "bun:test";
import { generateSceneImage } from "./generateImage";
import type { ImageGenConfig } from "./types";

function config(overrides: Partial<ImageGenConfig> = {}): ImageGenConfig {
  return {
    generator: "a1111",
    a1111Endpoint: "",
    a1111Config: "",
    comfyuiEndpoint: "",
    comfyuiWorkflow: "",
    huggingFaceConfig: "",
    huggingFaceSpaceId: "",
    huggingFaceToken: null,
    nimEndpoint: "",
    nimConfig: "",
    nimToken: null,
    ...overrides,
  };
}

/**
 * A failure must surface to the caller: the turn flow stores no asset in that
 * case (identical to the disabled backend) and reports the error itself.
 */
describe("generateSceneImage failure handling", () => {
  test("rethrows a generator failure instead of resolving with a placeholder", async () => {
    await expect(
      generateSceneImage({
        imagePrompt: "a lighthouse",
        negativeImagePrompt: "",
        // Empty endpoint fails before any network call.
        imageGenConfig: config(),
      }),
    ).rejects.toThrow("Empty endpoint.");
  });

  test("an already-aborted signal rejects with AbortError before generating", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      generateSceneImage({
        imagePrompt: "a lighthouse",
        negativeImagePrompt: "",
        // The disabled generator would happily resolve with a data URL, so a
        // rejection here proves the abort check runs first.
        imageGenConfig: config({ generator: "disabled" }),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

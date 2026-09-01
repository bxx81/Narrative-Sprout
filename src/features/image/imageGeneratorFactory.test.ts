import { describe, expect, test } from "bun:test";
import { ImageGeneratorFactory } from "./imageGeneratorFactory";

describe("ImageGeneratorFactory", () => {
  test("creates disabled generator for unknown type", () => {
    ImageGeneratorFactory.reset();
    const gen = ImageGeneratorFactory.create("disabled");
    expect(gen).toBeDefined();
    expect(typeof gen.generate).toBe("function");
  });

  test("caches instances (singleton per type)", () => {
    ImageGeneratorFactory.reset();
    const a = ImageGeneratorFactory.create("a1111");
    const b = ImageGeneratorFactory.create("a1111");
    expect(a).toBe(b);
    const c = ImageGeneratorFactory.create("comfyui");
    expect(c).not.toBe(a);
  });

  test("creates all supported generator types", () => {
    ImageGeneratorFactory.reset();
    for (const type of ["disabled", "huggingface", "a1111", "comfyui", "nvidia_nim"] as const) {
      const gen = ImageGeneratorFactory.create(type);
      expect(gen.generate).toBeDefined();
    }
  });

  test("disabled generator returns fallback url", async () => {
    ImageGeneratorFactory.reset();
    const gen = ImageGeneratorFactory.create("disabled");
    const url = await gen.generate({
      prompt: "test",
      negativePrompt: "",
      config: {} as never,
      onProgress: () => {},
    });
    expect(url).toContain("data:image/svg+xml");
  });
});

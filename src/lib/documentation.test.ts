import { describe, expect, test } from "bun:test";
import { documentationAnchor, documentationBaseUrl, documentationUrl } from "./documentation";

describe("documentationAnchor", () => {
  test("stable anchor map", () => {
    expect(documentationAnchor).toEqual({
      imageGenerators: "/image_generators",
      automatic1111: "/image_generators/a1111",
      comfyUI: "/image_generators/comfyui",
      huggingFace: "/image_generators/hugging_face",
      nvidiaNim: "/image_generators/nvidia_nim",
      gettingStarted: "/play/start",
      edit: "/play/edit",
      streaming: "/text_generators/streaming",
      llmOptions: "/text_generators/llm_options",
      compaction: "/text_generators/compaction",
      apiKeyPkce: "/text_generators/api_key_pkce",
      backupRestore: "/data_management/backup_restore",
      translation: "/settings/translation",
    });
  });

  test("every anchor is a root-relative docs path", () => {
    for (const anchor of Object.values(documentationAnchor)) {
      expect(anchor.startsWith("/")).toBe(true);
      expect(anchor).not.toMatch(/\/$/);
    }
  });
});

describe("documentationUrl", () => {
  test("Japanese uses the unprefixed default locale", () => {
    expect(documentationUrl(documentationAnchor.automatic1111, "ja")).toBe(
      `${documentationBaseUrl}/image_generators/a1111`,
    );
  });

  test("other languages fall back to the English locale", () => {
    expect(documentationUrl(documentationAnchor.automatic1111, "en")).toBe(
      `${documentationBaseUrl}/en/image_generators/a1111`,
    );
    expect(documentationUrl(documentationAnchor.automatic1111, "ko")).toBe(
      `${documentationBaseUrl}/en/image_generators/a1111`,
    );
  });

  test("defaults to English when no language is given", () => {
    expect(documentationUrl(documentationAnchor.gettingStarted)).toBe(
      `${documentationBaseUrl}/en/play/start`,
    );
  });
});

import { describe, expect, test } from "bun:test";
import { defaultSettingsRecord, settingsRecordSchema } from "./settings";

describe("SettingsRecord", () => {
  test("default record has expected shape", () => {
    expect(defaultSettingsRecord.language).toBe("Japanese");
    expect(defaultSettingsRecord.sceneTextLength).toBe("medium");
    expect(defaultSettingsRecord.imageGenerator).toBe("disabled");
    expect(defaultSettingsRecord.webpCompression).toBe("normal");
    expect(defaultSettingsRecord.memoryStrategy).toBe("single");
    expect(defaultSettingsRecord.enableStoryLogCompaction).toBe(true);
  });

  test("parses minimal record with defaults for new fields", () => {
    const minimal = {
      key: "app" as const,
      language: "English",
      sceneTextLength: "short",
      textModel: "model",
    };
    const parsed = settingsRecordSchema.safeParse(minimal);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.imageGenerator).toBe("disabled");
      expect(parsed.data.a1111Endpoint).toBe("http://127.0.0.1:7860");
      expect(parsed.data.enableStoryLogCompaction).toBe(true);
      expect(parsed.data.showElapsedTime).toBe(false);
      expect(parsed.data.autoRetrySeconds).toBe(0);
    }
  });

  test("rejects invalid imageGenerator", () => {
    const parsed = settingsRecordSchema.safeParse({
      ...defaultSettingsRecord,
      imageGenerator: "unknown",
    });
    expect(parsed.success).toBe(false);
  });

  test("has defaults for endpoint configs", () => {
    const parsed = settingsRecordSchema.safeParse({
      key: "app",
      language: "Japanese",
      sceneTextLength: "medium",
      textModel: "openai/gpt-4o-mini",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(typeof parsed.data.a1111Config).toBe("string");
      expect(typeof parsed.data.comfyuiWorkflow).toBe("string");
      expect(typeof parsed.data.huggingFaceConfig).toBe("string");
    }
  });
});

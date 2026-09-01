import { describe, test, expect } from "bun:test";
import { parseTextModelOptions, isStreamingEnabledForSettings } from "./modelOptions";

describe("parseTextModelOptions", () => {
  test("parses a bare model id with streaming enabled by default", () => {
    const options = parseTextModelOptions("openai/gpt-4o-mini");
    expect(options.model).toBe("openai/gpt-4o-mini");
    expect(options.stream).toBe(true);
  });

  test("parses trailing options", () => {
    const options = parseTextModelOptions(
      "x-ai/grok-4.1-fast --BaseURL=https://x.test --stream=false",
    );
    expect(options.model).toBe("x-ai/grok-4.1-fast");
    expect(options.stream).toBe(false);
  });

  test("--stream=true keeps streaming enabled", () => {
    expect(parseTextModelOptions("provider/model --stream=true").stream).toBe(true);
  });
});

describe("isStreamingEnabledForSettings", () => {
  test("global toggle off wins", () => {
    expect(
      isStreamingEnabledForSettings({ enableStreaming: false, textModel: "openai/gpt-4o-mini" }),
    ).toBe(false);
  });

  test("per-model opt-out disables streaming even when globally on", () => {
    expect(
      isStreamingEnabledForSettings({
        enableStreaming: true,
        textModel: "provider/model --stream=false",
      }),
    ).toBe(false);
  });

  test("enabled when both global and per-model allow", () => {
    expect(
      isStreamingEnabledForSettings({ enableStreaming: true, textModel: "provider/model" }),
    ).toBe(true);
  });
});

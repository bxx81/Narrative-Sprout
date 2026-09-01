import { describe, test, expect } from "bun:test";
import {
  parseTextModelOptions,
  buildSamplingParams,
  isStreamingEnabledForSettings,
  DEFAULT_OPENROUTER_BASE_URL,
} from "./modelOptions";

describe("parseTextModelOptions", () => {
  test("parses a bare model id with streaming enabled by default", () => {
    const options = parseTextModelOptions("openai/gpt-4o-mini");
    expect(options.model).toBe("openai/gpt-4o-mini");
    expect(options.stream).toBe(true);
    expect(options.isValid).toBe(true);
    expect(options.baseUrl).toBe(DEFAULT_OPENROUTER_BASE_URL);
  });

  test("parses trailing options", () => {
    const options = parseTextModelOptions(
      "x-ai/grok-4.1-fast --BaseURL=https://x.test --stream=false",
    );
    expect(options.model).toBe("x-ai/grok-4.1-fast");
    expect(options.stream).toBe(false);
    expect(options.baseUrl).toBe("https://x.test");
    expect(options.isValid).toBe(true);
  });

  test("--stream=true keeps streaming enabled", () => {
    expect(parseTextModelOptions("provider/model --stream=true").stream).toBe(true);
  });

  test("parses sampling and reasoning options", () => {
    const options = parseTextModelOptions(
      "provider/model --temperature=0.7 --max_tokens=2048 --reasoning=low --only=google-ai-studio --strict=false",
    );
    expect(options.temperature).toBe(0.7);
    expect(options.maxTokens).toBe(2048);
    expect(options.reasoning).toBe("low");
    expect(options.only).toBe("google-ai-studio");
    expect(options.isValid).toBe(true);
  });

  test("rejects non-http BaseURL, unknown options and bad values", () => {
    expect(parseTextModelOptions("m --BaseURL=ftp://x").isValid).toBe(false);
    expect(parseTextModelOptions("m --bogus=1").isValid).toBe(false);
    expect(parseTextModelOptions("m --stream=maybe").isValid).toBe(false);
    expect(parseTextModelOptions("").isValid).toBe(false);
  });
});

describe("buildSamplingParams", () => {
  test("maps options onto OpenAI-compatible body fields", () => {
    const options = parseTextModelOptions(
      "m --temperature=0.5 --max_tokens=99 --reasoning=true --only=azure",
    );
    const params = buildSamplingParams(options);
    expect(params.temperature).toBe(0.5);
    expect(params.max_completion_tokens).toBe(99);
    expect(params.reasoning).toEqual({ effort: "true" });
    expect(params.provider).toEqual({ only: ["azure"] });
  });

  test("omits unset options but keeps the token limit default", () => {
    const params = buildSamplingParams(parseTextModelOptions("m"));
    expect(params).toEqual({ max_completion_tokens: 10 * 1024 });
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

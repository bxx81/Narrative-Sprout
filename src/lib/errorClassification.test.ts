import { describe, test, expect } from "bun:test";
import { ApiError } from "./openAiClient";
import { classifyError } from "./errorClassification";

describe("classifyError", () => {
  test("429 maps to the overloaded key and is retryable", () => {
    const result = classifyError(new ApiError(429, "rate limited"));
    expect(result.message).toBe("errorApiOverloaded");
    expect(result.messageIsKey).toBe(true);
    expect(result.isRetryable).toBe(true);
    expect(result.status).toBe(429);
  });

  test("401/402/403 are not retryable", () => {
    for (const status of [401, 402, 403]) {
      const result = classifyError(new ApiError(status, "nope"));
      expect(result.isRetryable).toBe(false);
      expect(result.status).toBe(status);
    }
  });

  test("other API statuses keep a status hint and are retryable", () => {
    const result = classifyError(new ApiError(503, "provider busy"));
    expect(result.message).toBe("503: No available model provider");
    expect(result.messageIsKey).toBe(false);
    expect(result.isRetryable).toBe(true);
  });

  test("user abort is informational only", () => {
    const abort = new DOMException("The operation was aborted.", "AbortError");
    const result = classifyError(abort);
    expect(result.message).toBe("errorAborted");
    expect(result.messageIsKey).toBe(true);
    expect(result.isRetryable).toBe(false);
    expect(result.onlyInformation).toBe(true);
  });

  test("timeout is retryable", () => {
    const result = classifyError(new DOMException("timed out", "TimeoutError"));
    expect(result.message).toBe("errorApiGeneric");
    expect(result.isRetryable).toBe(true);
  });

  test("generation failures (invalid JSON etc.) keep the message and are retryable", () => {
    const result = classifyError(new Error("LLM returned invalid JSON"));
    expect(result.message).toBe("LLM returned invalid JSON");
    expect(result.messageIsKey).toBe(false);
    expect(result.isRetryable).toBe(true);
  });
});

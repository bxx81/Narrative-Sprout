import { describe, expect, test } from "bun:test";
import { buildImageFailureMessage } from "./notifications";
import { ApiError } from "../../lib/openAiClient";
import { IMAGE_FAILURE_REASON_MAX_LENGTH } from "../../lib/truncateText";

describe("buildImageFailureMessage", () => {
  test("user Stop is never reported", () => {
    expect(buildImageFailureMessage(new DOMException("Aborted", "AbortError"))).toBeNull();
  });

  test("a generator failure reports headline and reason on separate lines", () => {
    const message = buildImageFailureMessage(
      new Error("HuggingFace Space is over its monthly quota (429)."),
    );
    expect(message).not.toBeNull();
    const [headline, reason] = message!.split("\n");
    expect(headline).toBeTruthy();
    expect(reason).toBe("HuggingFace Space is over its monthly quota (429).");
  });

  test("a classified API error uses the translated reason", () => {
    const message = buildImageFailureMessage(new ApiError(429, "rate limited"));
    expect(message).not.toBeNull();
    const lines = message!.split("\n");
    expect(lines.length).toBe(2);
    // `errorApiOverloaded` is an i18n key, so the raw message is not shown.
    expect(lines[1]).not.toBe("rate limited");
    expect(lines[1]).toBeTruthy();
  });

  test("an error without a message falls back to the headline alone", () => {
    const message = buildImageFailureMessage(new Error(""));
    expect(message).not.toBeNull();
    expect(message!.split("\n").length).toBe(1);
  });

  test("a long reason is truncated to the display limit", () => {
    const message = buildImageFailureMessage(new Error("x".repeat(500)));
    const reason = message!.split("\n")[1]!;
    expect(Array.from(reason).length).toBeLessThanOrEqual(
      IMAGE_FAILURE_REASON_MAX_LENGTH + 1, // + ellipsis
    );
    expect(reason.endsWith("…")).toBe(true);
  });
});

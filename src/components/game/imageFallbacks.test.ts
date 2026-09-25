import { describe, expect, test } from "bun:test";
import type { SyntheticEvent } from "react";
import { applyLoadScreenFallback, LOAD_SCREEN_FALLBACK_URL } from "./imageFallbacks";

function errorEvent(src: string): {
  event: SyntheticEvent<HTMLImageElement, Event>;
  image: { src: string };
} {
  const image = { src };
  return {
    image,
    event: { currentTarget: image } as unknown as SyntheticEvent<HTMLImageElement, Event>,
  };
}

describe("applyLoadScreenFallback", () => {
  test("swaps a failed source for the not-available placeholder", () => {
    const { event, image } = errorEvent("blob:http://localhost/dead-beef");
    applyLoadScreenFallback(event);
    expect(image.src).toBe(LOAD_SCREEN_FALLBACK_URL);
  });

  test("does not loop when the placeholder itself is what failed", () => {
    const { event, image } = errorEvent(LOAD_SCREEN_FALLBACK_URL);
    applyLoadScreenFallback(event);
    expect(image.src).toBe(LOAD_SCREEN_FALLBACK_URL);
  });
});

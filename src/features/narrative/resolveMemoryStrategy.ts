import type { MemoryStrategy } from "../../types/settings";

/**
 * Resolves `auto` against scene length: split only for long novel-length scenes.
 * Matches legacy `resolveMemoryStrategy` semantics.
 */
export function resolveMemoryStrategy(
  strategy: MemoryStrategy | undefined,
  sceneTextLength: string,
): "single" | "split" {
  if (strategy === "split") return "split";
  if (strategy === "auto") {
    return sceneTextLength === "novel" || sceneTextLength === "novel2" ? "split" : "single";
  }
  return "single";
}

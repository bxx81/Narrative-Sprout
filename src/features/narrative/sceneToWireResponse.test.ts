import { describe, expect, test } from "bun:test";
import { sceneToWireResponse } from "./sceneSchema";
import type { MemoryDelta, SceneContent } from "../../types";

function makeScene(overrides: Partial<SceneContent> = {}): SceneContent {
  return {
    reasoning: "hidden scratchpad",
    sceneText: "本文",
    sceneWordCount: 2,
    imagePrompt: "a prompt",
    negativeImagePrompt: "no people",
    choices: ["進む", "戻る", "調べる"],
    isStoryOver: false,
    storyClosingText: "",
    locationContext: "城",
    ...overrides,
  };
}

const memoryDelta: MemoryDelta = {
  notes: { "char:hero": "騎士", "status:reader": "移動中" },
  sceneSummary: "騎士が城に到着した。",
};

describe("sceneToWireResponse", () => {
  test("maps stored scene fields onto the wire schema (choice1..3, finalEndingPassage)", () => {
    const wire = sceneToWireResponse(makeScene(), memoryDelta);
    expect(wire).toEqual({
      sceneText: "本文",
      locationContext: "城",
      imagePrompt: "a prompt",
      negativeImagePrompt: "no people",
      choice1: "進む",
      choice2: "戻る",
      choice3: "調べる",
      isStoryOver: false,
      finalEndingPassage: "",
      sceneSummary: "騎士が城に到着した。",
      notes: { "char:hero": "騎士", "status:reader": "移動中" },
    });
  });

  test("never leaks stored-only fields (reasoning, sceneWordCount, choices array)", () => {
    const json = JSON.stringify(sceneToWireResponse(makeScene(), memoryDelta));
    expect(json).not.toContain("reasoning");
    expect(json).not.toContain("sceneWordCount");
    expect(json).not.toContain('"choices"');
    expect(json).not.toContain("storyClosingText");
  });

  test("omits empty memory fields", () => {
    const wire = sceneToWireResponse(makeScene(), { notes: {}, sceneSummary: "" });
    expect("sceneSummary" in wire).toBe(false);
    expect("notes" in wire).toBe(false);
  });

  test("omitMemoryFields strips notes/sceneSummary (split-strategy scene call)", () => {
    const wire = sceneToWireResponse(makeScene(), memoryDelta, { omitMemoryFields: true });
    expect("sceneSummary" in wire).toBe(false);
    expect("notes" in wire).toBe(false);
    expect(wire.choice1).toBe("進む");
  });

  test("works without a memory delta", () => {
    const wire = sceneToWireResponse(makeScene());
    expect("notes" in wire).toBe(false);
    expect(wire.choice2).toBe("戻る");
  });

  test("maps story end fields", () => {
    const wire = sceneToWireResponse(
      makeScene({ isStoryOver: true, storyClosingText: "こうして物語は閉じた。" }),
      memoryDelta,
    );
    expect(wire.isStoryOver).toBe(true);
    expect(wire.finalEndingPassage).toBe("こうして物語は閉じた。");
  });
});

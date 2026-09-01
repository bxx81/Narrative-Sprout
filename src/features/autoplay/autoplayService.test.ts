import { describe, test, expect } from "bun:test";
import { buildAutoplayLog } from "./autoplayService";
import type { GameRecord, StoryNodeRecord } from "../../types";

let seq = 0;
function makeNode(options: {
  parentNodeId: string | null;
  isStoryOver?: boolean;
  autoplayReasoning?: string | null;
  choiceText?: string | null;
}): StoryNodeRecord {
  seq += 1;
  return {
    id: `node-${seq}` as StoryNodeRecord["id"],
    gameId: "game-1" as StoryNodeRecord["gameId"],
    parentNodeId: (options.parentNodeId as StoryNodeRecord["parentNodeId"]) ?? null,
    turnNumber: 1,
    choiceText: options.choiceText ?? (options.parentNodeId ? `choice ${seq}` : null),
    scene: {
      reasoning: "",
      sceneText: `scene ${seq}`,
      sceneWordCount: 2,
      imagePrompt: "img",
      negativeImagePrompt: "",
      choices: ["a", "b", "c"],
      isStoryOver: options.isStoryOver ?? false,
      storyClosingText: options.isStoryOver ? "closing" : "",
      locationContext: "",
    },
    promptSent: "p",
    memory: { notes: {}, storyLog: [] },
    memoryDelta: { notes: {}, sceneSummary: "s" },
    metadata: {
      generationCost: null,
      modelName: null,
      discardHistoryContext: false,
      refinePrompt: null,
      refinedFromNodeId: null,
      autoplayReasoning: options.autoplayReasoning ?? null,
    },
    createdAt: new Date(2026, 0, seq).toISOString(),
  };
}

function makeGame(): GameRecord {
  return {
    id: "game-1" as GameRecord["id"],
    schemaVersion: 1,
    title: "A knight's tale",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastPlayedAt: "2026-01-01T00:00:00.000Z",
    latestNodeId: null,
    attachmentTexts: [],
  };
}

describe("buildAutoplayLog", () => {
  test("compiles the root-to-viewed path with theme and choices", () => {
    const game = makeGame();
    const root = makeNode({ parentNodeId: null });
    const leaf = makeNode({ parentNodeId: root.id });
    const { text, isStoryOver } = buildAutoplayLog(game, [root, leaf], leaf.id);
    expect(text).toContain("## Theme\n\nA knight's tale");
    expect(text).toContain("## Scene text: Turn 1");
    expect(text).toContain("## Scene text: Turn 2");
    expect(text).toContain("## Player's choice");
    expect(text).toContain("* a");
    expect(isStoryOver).toBe(false);
  });

  test("carries the persisted autoplay reasoning chain into the log", () => {
    const game = makeGame();
    const root = makeNode({ parentNodeId: null });
    const leaf = makeNode({ parentNodeId: root.id, autoplayReasoning: "investigate the castle" });
    const { text } = buildAutoplayLog(game, [root, leaf], leaf.id);
    expect(text).toContain("## Reasoning");
    expect(text).toContain("investigate the castle");
  });

  test("detects the story ending from the viewed node", () => {
    const game = makeGame();
    const root = makeNode({ parentNodeId: null });
    const leaf = makeNode({ parentNodeId: root.id, isStoryOver: true });
    const { text, isStoryOver } = buildAutoplayLog(game, [root, leaf], leaf.id);
    expect(isStoryOver).toBe(true);
    expect(text).toContain("## Story closing text");
    // Turn 1 legitimately lists choices; the viewed (final) turn must NOT.
    expect(text).not.toContain("closing\n\n## Choices");
  });
});

import { describe, expect, test } from "bun:test";
import {
  buildCompactionPrompt,
  buildMemoryUpdatePrompt,
  buildOpeningPrompt,
  buildTurnPrompt,
} from "./promptBuilder";
import type { StoryNodeRecord } from "../../types";

function makeNode(
  id: string,
  parentNodeId: string | null,
  turnNumber: number,
  promptSent = "choice",
): StoryNodeRecord {
  return {
    id: id as StoryNodeRecord["id"],
    gameId: "g" as StoryNodeRecord["gameId"],
    parentNodeId: parentNodeId as StoryNodeRecord["parentNodeId"],
    turnNumber,
    choiceText: promptSent === "choice" ? null : promptSent,
    scene: {
      reasoning: "",
      sceneText: `scene ${id}`,
      sceneWordCount: 10,
      imagePrompt: "prompt",
      negativeImagePrompt: "",
      choices: ["a", "b", "c"],
      isStoryOver: false,
      storyClosingText: "",
      locationContext: "",
    },
    promptSent,
    memory: { notes: {}, storyLog: [] },
    memoryDelta: { notes: {}, sceneSummary: "" },
    metadata: {
      generationCost: null,
      modelName: null,
      discardHistoryContext: false,
      refinePrompt: null,
      refinedFromNodeId: null,
    },
    createdAt: "",
  };
}

describe("buildOpeningPrompt", () => {
  test("includes system with theme and attachment pair when provided", () => {
    const { system, messages } = buildOpeningPrompt({
      theme: "world",
      language: "Japanese",
      sceneTextLength: "medium",
      attachmentTexts: ["--- Attachment: a.txt ---\nhello\n--- End Attachment ---"],
    });
    expect(system).toContain("world");
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toContain("hello");
    expect(messages[2].content).toContain("Begin the story");
  });

  test("resolves conditional attachments against empty notes on opening", () => {
    const { messages } = buildOpeningPrompt({
      theme: "world",
      language: "Japanese",
      sceneTextLength: "medium",
      attachmentTexts: ["before <flag:test>secret</flag:test> after"],
    });
    // empty notes -> flag falsy -> secret hidden
    expect(messages[0].content).not.toContain("secret");
    expect(messages[0].content).toContain("before");
  });

  test("without attachments has only opening note", () => {
    const { messages } = buildOpeningPrompt({
      theme: "world",
      language: "Japanese",
      sceneTextLength: "medium",
    });
    expect(messages).toHaveLength(1);
  });
});

describe("buildTurnPrompt", () => {
  test("builds history from ancestors and injects memory and attachments", () => {
    const root = makeNode("root", null, 1, "root prompt");
    const a = makeNode("a", "root", 2, "choice a");
    const { system, messages } = buildTurnPrompt({
      theme: "world",
      language: "Japanese",
      sceneTextLength: "medium",
      ancestorNodes: [a, root],
      memory: { notes: { "flag:x": "1" }, storyLog: ["old"] },
      choiceText: "new choice",
      attachmentTexts: ["note <flag:x>shown</flag:x>"],
    });
    expect(system).toContain("world");
    // messages: attachment pair (2) + memory pair (2) + history pairs (4) + final choice (1) = 9
    // But historyPairs are for ancestors [a, root] reversed -> [root, a] -> 2 nodes -> 4 messages
    expect(messages.length).toBeGreaterThanOrEqual(7);
    // attachment resolved: flag:x is truthy, so shown should appear
    const attachmentMsg = messages[0].content;
    expect(attachmentMsg).toContain("shown");
    // memory block
    const memoryMsg = messages.find((m) => m.content.includes("Current long-term memory"));
    expect(memoryMsg).toBeDefined();
    expect(memoryMsg!.content).toContain("flag:x");
    // final choice
    expect(messages[messages.length - 1].content).toContain("new choice");
  });

  test("respects MAX_HISTORY_TURNS (5)", () => {
    const nodes = Array.from({ length: 10 }, (_, i) =>
      makeNode(`n${i}`, i === 0 ? null : `n${i - 1}`, i + 1, `choice ${i}`),
    );
    const { messages } = buildTurnPrompt({
      theme: "t",
      language: "Japanese",
      sceneTextLength: "medium",
      ancestorNodes: nodes.reverse(), // newest first
      memory: { notes: {}, storyLog: [] },
      choiceText: "next",
    });
    // history pairs: 5 turns *2 =10 + attachment? none + memory 2 + final 1 =13
    // So total should be 13 (2 memory +10 history +1 final)
    expect(messages).toHaveLength(13);
  });
});

describe("buildMemoryUpdatePrompt", () => {
  test("builds keeper prompt with sceneText and notesDraft", () => {
    const { system, messages } = buildMemoryUpdatePrompt({
      theme: "world",
      language: "Japanese",
      sceneText: "scene text here",
      notesDraft: "draft",
      memory: { notes: {}, storyLog: [] },
      turnNumber: 1,
      attachmentTexts: [],
    });
    expect(system).toContain("memory keeper");
    expect(messages[messages.length - 1].content).toContain("scene text here");
    expect(messages[messages.length - 1].content).toContain("draft");
  });

  test("first turn mentions populate notes", () => {
    const { messages } = buildMemoryUpdatePrompt({
      theme: "t",
      language: "Japanese",
      sceneText: "x",
      memory: { notes: {}, storyLog: [] },
      turnNumber: 1,
    });
    expect(messages[messages.length - 1].content).toContain("first turn");
  });
});

describe("buildCompactionPrompt", () => {
  test("builds archivist prompt with attachments and storyLog", () => {
    const { system, messages } = buildCompactionPrompt({
      theme: "world",
      language: "Japanese",
      storyLog: ["event 1", "event 2"],
      existingSummary: "old summary",
      attachmentTexts: ["attach <flag:x>cond</flag:x>"],
      flags: { "flag:x": "1" },
    });
    expect(system).toContain("archivist");
    expect(messages[0].content).toContain("event 1");
    expect(messages[0].content).toContain("old summary");
    // attachment resolved: flag:x truthy -> cond shown
    expect(messages[0].content).toContain("cond");
  });
});

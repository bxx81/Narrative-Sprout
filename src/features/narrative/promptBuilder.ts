import type { ChatMessage } from "../../lib/openAiClient";
import type { MemoryState, StoryNodeRecord } from "../../types";
import { buildNarratorSystemPrompt } from "./systemPrompt";

/** How many past turns of conversation are replayed to the model. */
export const MAX_HISTORY_TURNS = 5;

/** Word targets per sceneTextLength setting (matches legacy length orders). */
const LENGTH_INSTRUCTIONS: Record<string, string> = {
  short: "around 80 words",
  medium: "around 200 words",
  long: "around 400 words",
};

function lengthInstruction(sceneTextLength: string): string {
  return LENGTH_INSTRUCTIONS[sceneTextLength] ?? LENGTH_INSTRUCTIONS["medium"]!;
}

const OPENING_USER_NOTE =
  "This is the opening scene based on the World Theme above. Begin the story now.";

/**
 * Builds the message list for the FIRST turn of a game.
 */
export function buildOpeningPrompt(params: {
  theme: string;
  language: string;
  sceneTextLength: string;
}): { system: string; messages: ChatMessage[] } {
  const system = buildNarratorSystemPrompt(params.theme, params.language);
  const messages: ChatMessage[] = [
    {
      role: "user",
      content:
        `${OPENING_USER_NOTE}\n` +
        `Target scene length: ${lengthInstruction(params.sceneTextLength)}.`,
    },
  ];
  return { system, messages };
}

/**
 * Builds the message list for a subsequent turn:
 * system + latest memory + up to 5 past turns (user promptSent / assistant
 * scene JSON pairs, oldest first) + the current choice.
 */
export function buildTurnPrompt(params: {
  theme: string;
  language: string;
  sceneTextLength: string;
  /** Path from the parent of the new node back to the root, NEWEST first. */
  ancestorNodes: StoryNodeRecord[];
  memory: MemoryState;
  choiceText: string;
}): { system: string; messages: ChatMessage[] } {
  const system = buildNarratorSystemPrompt(params.theme, params.language);
  const historyPairs = params.ancestorNodes
    .slice(0, MAX_HISTORY_TURNS)
    .reverse()
    .flatMap((node): ChatMessage[] => [
      { role: "user", content: node.promptSent },
      { role: "assistant", content: JSON.stringify(node.scene) },
    ]);

  const messages: ChatMessage[] = [
    {
      role: "user",
      content:
        "Current long-term memory:\n" +
        JSON.stringify(
          {
            notes: params.memory.notes,
            storyLog: params.memory.storyLog,
            ...(params.memory.storyLogSummary
              ? { storyLogSummary: params.memory.storyLogSummary }
              : {}),
          },
          null,
          2,
        ),
    },
    { role: "assistant", content: "Understood. I will maintain and use this memory." },
    ...historyPairs,
    {
      role: "user",
      content:
        `${params.choiceText}\n` +
        `Target scene length: ${lengthInstruction(params.sceneTextLength)}. ` +
        "Output ONLY the keys that changed in notes.",
    },
  ];
  return { system, messages };
}

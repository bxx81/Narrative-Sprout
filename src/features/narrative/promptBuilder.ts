import type { ChatMessage } from "../../lib/openAiClient";
import type { MemoryState, StoryNodeRecord } from "../../types";
import { buildNarratorSystemPrompt } from "./systemPrompt";
import { sceneToWireResponse } from "./sceneSchema";
import { createFlagMap, resolveConditionalText } from "../attachments/conditionalText";

/** How many past turns of conversation are replayed to the model. */
export const MAX_HISTORY_TURNS = 5;

/** Word targets per sceneTextLength setting (matches legacy length orders). */
const LENGTH_INSTRUCTIONS: Record<string, string> = {
  short: "between 50 and 100 words",
  medium: "between 100 and 200 words",
  default: "between 50 and 100 words",
  detailed: "between 100 and 200 words, unfolding like a detailed short story",
  verbose: "200+ words, with highly vivid and descriptive prose",
  novel: "between 400 and 1200 words, rich and immersive like a novel",
  novel2: "between 800 and 1600 words, rich and immersive like a novel",
  long: "between 200 and 400 words",
};

function lengthInstruction(sceneTextLength: string): string {
  return LENGTH_INSTRUCTIONS[sceneTextLength] ?? LENGTH_INSTRUCTIONS["medium"]!;
}

const OPENING_USER_NOTE =
  "This is the opening scene based on the World Theme above. Begin the story now.";

function resolveAttachments(
  attachmentTexts: string[],
  notes: Record<string, string | null>,
): string[] {
  if (!attachmentTexts || attachmentTexts.length === 0) return [];
  const flagMap = createFlagMap(notes);
  return attachmentTexts.map((text) => resolveConditionalText(text, flagMap));
}

function buildAttachmentMessages(
  attachmentTexts: string[],
  notes: Record<string, string | null>,
): ChatMessage[] {
  const resolved = resolveAttachments(attachmentTexts, notes);
  const filtered = resolved.filter((t) => t.trim().length > 0);
  if (filtered.length === 0) return [];
  return [
    { role: "user", content: filtered.join("\n\n") },
    {
      role: "assistant",
      content:
        "Understood. I will use the provided text as the primary source of truth for the story.",
    },
  ];
}

/**
 * Builds the message list for the FIRST turn of a game.
 */
export function buildOpeningPrompt(params: {
  theme: string;
  language: string;
  sceneTextLength: string;
  attachmentTexts?: string[];
}): { system: string; messages: ChatMessage[] } {
  const system = buildNarratorSystemPrompt(params.theme, params.language);
  const attachmentMessages = buildAttachmentMessages(params.attachmentTexts ?? [], {});
  const messages: ChatMessage[] = [
    ...attachmentMessages,
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
 * system + attachments + latest memory + up to 5 past turns (user promptSent / assistant
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
  attachmentTexts?: string[];
  /**
   * Split-strategy scene call: past turns must not show notes/sceneSummary —
   * those come from the memory keeper call, and the narrator must not mimic
   * them in its scene-only output.
   */
  omitMemoryFields?: boolean;
}): { system: string; messages: ChatMessage[] } {
  const system = buildNarratorSystemPrompt(params.theme, params.language);
  const historyPairs = params.ancestorNodes
    .slice(0, MAX_HISTORY_TURNS)
    .reverse()
    .flatMap((node): ChatMessage[] => [
      { role: "user", content: node.promptSent },
      {
        role: "assistant",
        content: JSON.stringify(
          sceneToWireResponse(node.scene, node.memoryDelta, {
            omitMemoryFields: params.omitMemoryFields,
          }),
        ),
      },
    ]);

  const attachmentMessages = buildAttachmentMessages(
    params.attachmentTexts ?? [],
    params.memory.notes,
  );

  const messages: ChatMessage[] = [
    ...attachmentMessages,
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

/**
 * Builds the shared prefix for split-memory strategy: attachments + latest memory
 * (identical for scene call and memory-update call to allow prompt caching).
 */
export function buildContextPrefix(params: {
  attachmentTexts?: string[];
  memory: MemoryState;
}): ChatMessage[] {
  const attachmentMessages = buildAttachmentMessages(
    params.attachmentTexts ?? [],
    params.memory.notes,
  );
  const memoryMessages: ChatMessage[] = [
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
  ];
  return [...attachmentMessages, ...memoryMessages];
}

/**
 * Builds the message list for the memory-update call (split strategy call 2).
 * Uses the shared prefix so the provider can cache it.
 */
export function buildMemoryUpdatePrompt(params: {
  theme: string;
  language: string;
  sceneText: string;
  notesDraft?: string;
  attachmentTexts?: string[];
  memory: MemoryState;
  turnNumber: number;
  memoryReminder?: string;
}): { system: string; messages: ChatMessage[] } {
  // Memory-update system prompt is the archivist-style keeper prompt (distinct from narrator)
  const system = `You are the memory keeper for an interactive fiction. Your task is to update the long-term memory based on the provided scene text. Output ONLY a JSON object with "sceneSummary" (one objective factual sentence) and "notes" (a delta of changed keys, null to delete). Use char:/status:/lore:/flag:/num: prefixes. The story language is ${params.language}. Theme: ${params.theme}`;
  const prefix = buildContextPrefix({
    attachmentTexts: params.attachmentTexts,
    memory: params.memory,
  });
  const firstTurn = params.turnNumber <= 1;
  const instruction =
    `[Memory keeper request]\n` +
    `The narrator just wrote the scene for ${firstTurn ? "the first turn" : `turn ${params.turnNumber}`}. Read it and update the long-term memory.${firstTurn ? " This is the first turn: populate notes with everything extracted from the attachments and the world theme." : ""}\n\n` +
    `<scene_text>\n${params.sceneText}\n</scene_text>\n` +
    (params.notesDraft ? `\n<notes_draft>\n${params.notesDraft}\n</notes_draft>\n` : "") +
    (params.memoryReminder ? `\n[Memory keeper note: ${params.memoryReminder}]\n` : "") +
    `Output ONLY the memory update JSON.`;
  const messages: ChatMessage[] = [...prefix, { role: "user", content: instruction }];
  return { system, messages };
}

/**
 * Builds the archivist prompt for storyLog compaction (REDESIGN §5.2).
 */
export function buildCompactionPrompt(params: {
  theme: string;
  language: string;
  storyLog: string[];
  existingSummary: string;
  attachmentTexts?: string[];
  flags?: Record<string, string | null> | null;
}): { system: string; messages: ChatMessage[] } {
  const system = `You are the archivist for an interactive fiction. Compress the provided older story-log entries into the existing chronicle, preserving ALL plot-critical facts: items, relationships, flags, mysteries, locations. Story language is ${params.language}. Theme: ${params.theme}`;
  const attachmentTexts = params.attachmentTexts ?? [];
  const flags = params.flags ?? {};
  const flagMap = createFlagMap(flags as Record<string, string | null>);
  const resolvedAttachments = attachmentTexts
    .map((t) => resolveConditionalText(t, flagMap))
    .filter((t) => t.trim().length > 0);
  const attachmentsBlock =
    resolvedAttachments.length > 0
      ? `\nThe following attachments are part of the world's source of truth:\n<attachments>\n${resolvedAttachments.join("\n\n")}\n</attachments>\n`
      : "";
  const userText =
    `[Archivist request]\nCompress the following older story-log entries into the existing chronicle.\n` +
    `${attachmentsBlock}` +
    `<existing_chronicle>\n${params.existingSummary || "(none yet)"}\n</existing_chronicle>\n\n` +
    `<story_log_entries>\n${params.storyLog.map((e) => `- ${e}`).join("\n")}\n</story_log_entries>\n\n` +
    `Output ONLY the JSON object with "storyLogSummary" and "facts".`;
  return { system, messages: [{ role: "user", content: userText }] };
}

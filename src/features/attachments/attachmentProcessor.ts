import { parseScenarioFile, type ParsedScenarioFile } from "./parseScenarioFile";
import { processRandomChoice } from "./randomChoice";
import { createFlagMap, resolveConditionalText } from "./conditionalText";
import type { MemoryState } from "../../types";

/** Extensions handled as text attachments; `.b64` is decoded before parsing. */
const TEXT_ATTACHMENT_PATTERN = /\.(txt|md|b64)$/i;

/**
 * Result of processing a batch of user-provided attachment files.
 */
export interface ProcessedAttachments {
  /** World theme from the setup form (`{a|b}` applied; front matter never overrides it). */
  theme: string;
  /** Text blocks to inject into the prompt (one per file, after processing). */
  attachmentTexts: string[];
}

function decodeBase64File(content: string): string | null {
  const trimmed = content.trim();
  if (trimmed.length === 0) return null;
  try {
    const binary = atob(trimmed);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Reads a text attachment file (`.txt`/`.md` as text, `.b64` base64-decoded
 * first so it behaves exactly like `.txt`/`.md`) and parses its scenario
 * front matter. Returns `null` for non-text attachments or undecodable `.b64`.
 */
export async function readScenarioFile(file: File): Promise<ParsedScenarioFile | null> {
  if (!TEXT_ATTACHMENT_PATTERN.test(file.name)) return null;
  const raw = await file.text();
  const content = file.name.toLowerCase().endsWith(".b64") ? decodeBase64File(raw) : raw;
  if (content === null) return null;
  return parseScenarioFile(content);
}

/**
 * Processes raw file contents (already read as text) into the theme and
 * attachment texts, applying:
 * 1) YAML front-matter stripping (`theme` inside a file only pre-fills the
 *    setup form at upload time; here the form input is the single source of
 *    truth and the body becomes attachment text)
 * 2) `{a|b}` random choice resolution per file and on the form theme
 *    (applied once here so the save keeps a fixed resolution)
 * 3) Conditional text is NOT resolved here — it is resolved at prompt-build time
 *    against the current memory notes, so raw texts are kept.
 *
 * `files` may contain image and `.b64` entries; those are handled separately.
 * For `.b64`, the base64 is decoded before the other steps.
 */
export function processAttachmentContents(
  files: { name: string; content: string }[],
  baseTheme: string,
): ProcessedAttachments {
  const attachmentTexts: string[] = [];

  for (const file of files) {
    if (!TEXT_ATTACHMENT_PATTERN.test(file.name)) continue;

    let textContent = file.content;
    if (file.name.toLowerCase().endsWith(".b64")) {
      const decoded = decodeBase64File(file.content);
      if (decoded === null) continue;
      textContent = decoded;
    }

    const parsed = parseScenarioFile(textContent);
    const effective = parsed.theme !== null ? parsed.body : textContent;
    const finalText = processRandomChoice(effective);
    if (finalText.trim().length > 0) {
      attachmentTexts.push(wrapAttachment(file.name, finalText));
    }
  }

  return { theme: processRandomChoice(baseTheme), attachmentTexts };
}

/**
 * Reads `File` objects (browser) into `ProcessedAttachments`.
 * Text files are read as text; `.b64` is decoded.
 */
export async function processAttachmentFiles(
  files: File[],
  baseTheme: string,
): Promise<ProcessedAttachments> {
  const entries: { name: string; content: string }[] = [];
  for (const file of files) {
    if (!TEXT_ATTACHMENT_PATTERN.test(file.name)) continue;
    entries.push({ name: file.name, content: await file.text() });
  }
  return processAttachmentContents(entries, baseTheme);
}

/**
 * Resolves conditional blocks in attachment texts against current memory notes,
 * for use when building the prompt for a turn.
 */
export function resolveAttachmentTexts(
  attachmentTexts: string[],
  memory: MemoryState | null,
): string[] {
  if (!memory) return attachmentTexts;
  const flagMap = createFlagMap(memory.notes);
  return attachmentTexts.map((text) => resolveConditionalText(text, flagMap));
}

function wrapAttachment(fileName: string, processedText: string): string {
  return `--- Attachment: ${fileName} ---\n${processedText}\n--- End Attachment ---`;
}

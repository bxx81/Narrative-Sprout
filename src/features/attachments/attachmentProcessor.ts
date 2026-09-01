import { parseScenarioFile } from "./parseScenarioFile";
import { processRandomChoice } from "./randomChoice";
import { createFlagMap, resolveConditionalText } from "./conditionalText";
import type { MemoryState } from "../../types";

/**
 * Result of processing a batch of user-provided attachment files.
 */
export interface ProcessedAttachments {
  /** Resolved world theme (front-matter `theme` wins over the form input if present). */
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
 * Processes raw file contents (already read as text) into the final theme and
 * attachment texts, applying:
 * 1) YAML front-matter theme extraction (first file with a valid theme wins)
 * 2) `{a|b}` random choice resolution per file
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
  let theme = baseTheme;
  let themeSource: string | null = null;
  const attachmentTexts: string[] = [];

  for (const file of files) {
    const lower = file.name.toLowerCase();
    let textContent: string | null = null;

    if (lower.endsWith(".b64")) {
      const decoded = decodeBase64File(file.content);
      if (decoded === null) continue;
      textContent = decoded;
    } else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
      textContent = file.content;
    } else {
      // Image / unsupported: skip for text attachment list
      continue;
    }

    const parsed = parseScenarioFile(textContent);
    if (parsed.theme !== null && themeSource === null) {
      theme = parsed.theme;
      themeSource = file.name;
      if (parsed.body.trim().length > 0) {
        const processed = processRandomChoice(parsed.body);
        attachmentTexts.push(wrapAttachment(file.name, processed));
      }
    } else {
      // No theme or theme already taken: treat as plain attachment
      const effective = parsed.theme !== null ? parsed.body : textContent;
      const finalText = processRandomChoice(effective);
      if (finalText.trim().length > 0) {
        attachmentTexts.push(wrapAttachment(file.name, finalText));
      }
    }
  }

  return { theme, attachmentTexts };
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
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".b64")) {
      entries.push({ name: file.name, content: await file.text() });
    }
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

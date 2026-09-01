import * as yaml from "yaml";

/**
 * Parses a scenario file with optional YAML front matter (REDESIGN.md §4.4).
 *
 * ```markdown
 * ---
 * title: Example
 * theme: |
 *   multi-line theme
 * ---
 * # body (attachment text)
 * ```
 *
 * Rules:
 * - Front matter is recognized only when the file starts with `---\n`.
 * - The closing `---` must be on its own line. Horizontal rules inside the body
 *   are outside the front-matter range and never confuse the parser.
 * - `theme` key must be a string; when present → scenario file, `theme` is the
 *   game theme, `body` is the attachment text.
 * - Otherwise (no front matter, parse failure, or missing/invalid theme) →
 *   `theme` is `null` and the whole file is the attachment text.
 * - Unknown front-matter keys are ignored (future extensibility).
 */
export interface ParsedScenarioFile {
  theme: string | null;
  body: string;
  /** Front-matter parse warning, if any (never throws). */
  warning?: string;
}

export function parseScenarioFile(content: string): ParsedScenarioFile {
  if (!content.startsWith("---")) {
    return { theme: null, body: content };
  }
  // Find the closing `---` delimiter.
  // Accept both `\n---` and `\n---\n` / `\n---\r\n` styles.
  // The opening delimiter is at offset 0, so skip it.
  const afterOpen = content.slice(3);
  // Normalize: opening line must end with newline; `---` without newline is not front matter.
  if (!afterOpen.startsWith("\n") && !afterOpen.startsWith("\r\n")) {
    return { theme: null, body: content };
  }
  const rest = afterOpen.replace(/^\r?\n/, "");
  const lines = rest.split(/\r?\n/);
  let closeLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim() === "---") {
      closeLineIndex = i;
      break;
    }
  }
  if (closeLineIndex === -1) {
    return { theme: null, body: content };
  }
  const frontMatterText = lines.slice(0, closeLineIndex).join("\n");
  const body = lines.slice(closeLineIndex + 1).join("\n");

  let parsed: unknown;
  try {
    parsed = yaml.parse(frontMatterText);
  } catch (error) {
    return {
      theme: null,
      body: content,
      warning: `YAML front matter parse failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { theme: null, body: content };
  }
  const record = parsed as Record<string, unknown>;
  const themeValue = record["theme"];
  if (typeof themeValue !== "string") {
    // Has front matter but no valid theme → plain attachment.
    return { theme: null, body: content };
  }
  return { theme: themeValue, body };
}

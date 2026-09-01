import type { MemoryState } from "../../types";

/**
 * Hierarchical storyLog management (REDESIGN.md §5.2, legacy `storyLogCompaction.ts`).
 *
 * - `storyLog` is an ever-growing array of per-turn summaries.
 * - When it exceeds `STORY_LOG_ARCHIVE_THRESHOLD`, the oldest entries are sent
 *   to an archivist LLM to produce a compressed chronicle (`storyLogSummary`)
 *   and re-extracted durable facts (`flag:`/`num:`/`lore:`) to merge into `notes`.
 * - Live notes are always the source of truth; archived facts are merged only
 *   if the key is missing (non-destructive).
 */

/** Number of recent entries kept verbatim after compaction. */
export const RECENT_STORY_LOG_COUNT = 20;

/** Threshold: compact when storyLog length exceeds this. */
export const STORY_LOG_ARCHIVE_THRESHOLD = 30;

const ARCHIVED_FACT_PREFIXES = ["flag:", "num:", "lore:"] as const;

/**
 * Splits storyLog into older (to archive) and recent (to keep verbatim).
 */
export function splitStoryLog(storyLog: string[]): { older: string[]; recent: string[] } {
  if (storyLog.length <= RECENT_STORY_LOG_COUNT) {
    return { older: [], recent: storyLog };
  }
  return {
    older: storyLog.slice(0, storyLog.length - RECENT_STORY_LOG_COUNT),
    recent: storyLog.slice(-RECENT_STORY_LOG_COUNT),
  };
}

/**
 * Whether compaction should be triggered (storyLog exceeds threshold).
 */
export function shouldCompactStoryLog(storyLog: string[]): boolean {
  return storyLog.length > STORY_LOG_ARCHIVE_THRESHOLD;
}

/**
 * Merges facts extracted by the archivist into live notes.
 * - Only `flag:` / `num:` / `lore:` keys are considered.
 * - Existing keys are never overwritten (live state wins).
 * - `null` values are ignored (archived facts are never deletions).
 */
export function mergeArchivedFacts(
  notes: Record<string, string | null>,
  facts: Record<string, string | null> | undefined,
): Record<string, string | null> {
  if (!facts) return notes;
  let merged = notes;
  for (const [key, value] of Object.entries(facts)) {
    if (value === null) continue;
    if (key in notes) continue;
    if (!ARCHIVED_FACT_PREFIXES.some((p) => key.startsWith(p))) continue;
    if (merged === notes) merged = { ...notes };
    merged[key] = value;
  }
  return merged;
}

/**
 * Builds the memory state after compaction: keep only recent storyLog entries,
 * set `storyLogSummary` to the archivist's chronicle, and merge facts.
 */
export function compactMemory(
  memory: MemoryState,
  storyLogSummary: string,
  facts: Record<string, string | null> | undefined,
): MemoryState {
  const { recent } = splitStoryLog(memory.storyLog ?? []);
  return {
    ...memory,
    storyLog: recent,
    storyLogSummary,
    notes: mergeArchivedFacts(memory.notes, facts),
  };
}

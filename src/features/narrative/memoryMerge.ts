import type { MemoryDelta, MemoryState } from "../../types";

/**
 * Applies one turn's memory delta to accumulated memory.
 * - notes: set/replace keys; a `null` value deletes the key
 * - sceneSummary: appended to storyLog
 */
export function applyMemoryDelta(memory: MemoryState, delta: MemoryDelta): MemoryState {
  const notes = { ...memory.notes };
  for (const [key, value] of Object.entries(delta.notes)) {
    if (value === null) {
      delete notes[key];
    } else {
      notes[key] = value;
    }
  }
  return {
    ...memory,
    notes,
    storyLog: [...memory.storyLog, delta.sceneSummary],
  };
}

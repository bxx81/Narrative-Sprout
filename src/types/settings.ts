import { z } from "zod";

/**
 * Global application settings (REDESIGN.md §5.4).
 *
 * Contains ONLY non-secret configuration. Anything machine-specific but
 * harmless (endpoints, model names) belongs here; anything secret belongs in
 * `src/types/credential.ts`. Generation settings are global-only — save slots
 * hold none of them.
 *
 * Detailed fields grow in later phases; this is the Phase-1 foundation.
 */
export const SETTINGS_RECORD_KEY = "app" as const;

export const settingsRecordSchema = z.object({
  key: z.literal(SETTINGS_RECORD_KEY),
  /** Narrative language (e.g. "Japanese"). */
  language: z.string(),
  /** Target prose length order (e.g. "short" | "medium" | "long"). */
  sceneTextLength: z.string(),
});
export type SettingsRecord = z.infer<typeof settingsRecordSchema>;

export const defaultSettingsRecord: SettingsRecord = {
  key: SETTINGS_RECORD_KEY,
  language: "Japanese",
  sceneTextLength: "medium",
};

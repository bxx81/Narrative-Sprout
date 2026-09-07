import { db } from "./database";
import { defaultSettingsRecord, settingsRecordSchema, type SettingsRecord } from "../types";
import { getInitialUiLanguage } from "../features/i18n/api";

export const settingsRepository = {
  async get(): Promise<SettingsRecord> {
    const row = await db.settings.get("app");
    if (!row) {
      // First run (nothing stored yet): seed the narrative language from the
      // detected display language so story prompts match the UI immediately.
      const uiLanguage = getInitialUiLanguage();
      return { ...defaultSettingsRecord, uiLanguage, language: uiLanguage };
    }
    // Element-wise philosophy: malformed settings row → fall back to defaults
    // with a warning instead of crashing the whole app on startup.
    const parsed = settingsRecordSchema.safeParse(row);
    if (!parsed.success) {
      console.warn("[settings] stored settings invalid; using defaults", parsed.error);
      return defaultSettingsRecord;
    }
    return parsed.data;
  },
  async put(settings: SettingsRecord): Promise<void> {
    await db.settings.put(settings);
  },
};

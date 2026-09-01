import { db } from "./database";
import { defaultSettingsRecord, settingsRecordSchema, type SettingsRecord } from "../types";

export const settingsRepository = {
  async get(): Promise<SettingsRecord> {
    const row = await db.settings.get("app");
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

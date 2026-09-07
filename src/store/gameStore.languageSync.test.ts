import { describe, test, expect, beforeEach } from "bun:test";
import { db } from "../db/database";
import { settingsRepository } from "../db/settingsRepository";
import { useGameStore } from "./gameStore";
import { defaultSettingsRecord } from "../types";

/**
 * Display-language changes mirror into the narrative language
 * (`settings.language`), so story prompts follow the UI language.
 */

describe("display language mirrors into settings.language", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    useGameStore.setState({
      settings: { ...defaultSettingsRecord },
      openrouterApiKey: null,
      activeGame: null,
      nodes: [],
      viewingNodeId: null,
      currentNodeId: null,
      generation: { phase: "idle" },
      generationStage: null,
      imageGenerationProgress: null,
    });
  });

  test("setUiLanguage updates both uiLanguage and language", async () => {
    await useGameStore.getState().setUiLanguage("English");
    const settings = useGameStore.getState().settings!;
    expect(settings.uiLanguage).toBe("English");
    expect(settings.language).toBe("English");
  });

  test("deleteAiTranslation fallback mirrors into language", async () => {
    useGameStore.setState({
      settings: {
        ...useGameStore.getState().settings!,
        uiLanguage: "Español",
        language: "Español",
        aiTranslations: { Español: { title: "título" } },
        aiLanguageMappings: { Español: "es" },
      },
    });
    await useGameStore.getState().deleteAiTranslation("Español");
    const settings = useGameStore.getState().settings!;
    expect(settings.uiLanguage).toBe("English");
    expect(settings.language).toBe("English");
  });

  test("first run seeds language from the detected display language", async () => {
    const settings = await settingsRepository.get();
    expect(settings.language).toBe(settings.uiLanguage);
  });
});

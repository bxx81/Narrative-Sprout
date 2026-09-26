import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { db } from "../db/database";
import { useGameStore, translationLanguageActivation } from "./gameStore";
import { defaultSettingsRecord } from "../types";

const startedWith = { uiLanguage: "English", language: "English" };
const unchangedSettings = { ...defaultSettingsRecord, ...startedWith };

describe("translationLanguageActivation", () => {
  test("the fresh translation becomes the active language when nothing changed", () => {
    expect(translationLanguageActivation(startedWith, unchangedSettings, "Korean")).toEqual({
      uiLanguage: "Korean",
      language: "Korean",
    });
  });

  test("a language switched while the translation ran wins", () => {
    const current = { ...defaultSettingsRecord, uiLanguage: "日本語", language: "日本語" };
    expect(translationLanguageActivation(startedWith, current, "Korean")).toBeNull();
  });

  test("only the narrative language switched: still no activation", () => {
    const current = { ...defaultSettingsRecord, uiLanguage: "English", language: "日本語" };
    expect(translationLanguageActivation(startedWith, current, "Korean")).toBeNull();
  });

  test("a missing settings row never activates the translation", () => {
    expect(translationLanguageActivation(startedWith, null, "Korean")).toBeNull();
  });
});

describe("ui translation cancellation", () => {
  const realFetch = globalThis.fetch;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    useGameStore.setState({
      settings: {
        ...defaultSettingsRecord,
        ...startedWith,
        // A valid model reaches the first chunk (and its politeness delay);
        // an invalid one would fail before any request goes out.
        textModel: "openai/gpt-4o-mini",
      },
      openrouterApiKey: "sk-or-test",
      activeGame: null,
      nodes: [],
      viewingNodeId: null,
      currentNodeId: null,
      uiTranslation: { phase: "idle" },
      uiTranslationProgress: null,
    });
    // Hangs until the caller aborts, like a request waiting for its response.
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        const abort = () => reject(new DOMException("Aborted", "AbortError"));
        if (signal?.aborted) abort();
        else signal?.addEventListener("abort", abort);
      })) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("cancelUiTranslation settles the run silently and stores nothing", async () => {
    const running = useGameStore.getState().translateUi("Korean");
    expect(useGameStore.getState().uiTranslation.phase).toBe("running");

    useGameStore.getState().cancelUiTranslation();
    expect(useGameStore.getState().uiTranslation.phase).toBe("idle");
    expect(useGameStore.getState().uiTranslationProgress).toBeNull();

    // Resolves (no toast) instead of rejecting with the abort.
    await running;

    const settings = useGameStore.getState().settings!;
    expect(settings.aiTranslations["Korean"]).toBeUndefined();
    expect(settings.uiLanguage).toBe("English");
    expect(settings.language).toBe("English");
    expect(useGameStore.getState().uiTranslation.phase).toBe("idle");
  }, 10000);

  test("cancelling while idle is a no-op", () => {
    useGameStore.getState().cancelUiTranslation();
    expect(useGameStore.getState().uiTranslation.phase).toBe("idle");
  });
});

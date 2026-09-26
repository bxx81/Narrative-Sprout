import { describe, test, expect, beforeEach } from "bun:test";
import { db } from "../db/database";
import { settingsRepository } from "../db/settingsRepository";
import { useGameStore } from "./gameStore";
import { defaultSettingsRecord } from "../types";

/**
 * Settings writes are read back by the next turn of a long-running operation,
 * so an unparsable text model must never reach the store (or IndexedDB).
 */

describe("settings write guards", () => {
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
      imageRegeneration: { phase: "idle" },
      autoplayTurn: { phase: "idle" },
    });
  });

  test("updateSettings rejects an unparsable textModel and keeps the stored one", async () => {
    const previous = useGameStore.getState().settings!.textModel;

    await useGameStore.getState().updateSettings({ textModel: "" });
    expect(useGameStore.getState().settings!.textModel).toBe(previous);

    await useGameStore.getState().updateSettings({ textModel: "provider/model --bogus=1" });
    expect(useGameStore.getState().settings!.textModel).toBe(previous);

    expect((await settingsRepository.get()).textModel).toBe(previous);
  });

  test("updateSettings accepts a valid textModel with per-model options", async () => {
    const model = "provider/model --stream=false --timeout=60000";
    await useGameStore.getState().updateSettings({ textModel: model });
    expect(useGameStore.getState().settings!.textModel).toBe(model);
    expect((await settingsRepository.get()).textModel).toBe(model);
  });

  test("a rejected textModel does not block the other fields of the same update", async () => {
    await useGameStore.getState().updateSettings({
      textModel: "",
      showElapsedTime: !defaultSettingsRecord.showElapsedTime,
    });
    const settings = useGameStore.getState().settings!;
    expect(settings.textModel).toBe(defaultSettingsRecord.textModel);
    expect(settings.showElapsedTime).toBe(!defaultSettingsRecord.showElapsedTime);
  });

  test("dismissError also clears a failed autoplay decision", () => {
    useGameStore.setState({
      autoplayTurn: {
        phase: "failed",
        payload: { kind: "decision" },
        error: new Error("Model setting is invalid."),
      },
    });
    useGameStore.getState().dismissError();
    expect(useGameStore.getState().autoplayTurn.phase).toBe("idle");
  });
});

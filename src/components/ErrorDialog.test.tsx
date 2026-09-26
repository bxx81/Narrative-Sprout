import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import ErrorDialog from "./ErrorDialog";
import { useGameStore } from "../store/gameStore";
import { defaultSettingsRecord } from "../types";

// The dialog is the only surface for a failed autoplay decision (no payload to
// re-run), so it must show up for `autoplayTurn: failed` — dismiss-only — and
// keep offering Retry for a failed narrative generation.

describe("ErrorDialog autoplay failures", () => {
  let root: Root | null = null;
  let container: HTMLElement | null = null;

  beforeAll(async () => {
    const win = new Window();
    for (const key of ["window", "document", "navigator"] as const) {
      Object.defineProperty(globalThis, key, {
        value: key === "document" ? win.document : key === "window" ? win : win.navigator,
        configurable: true,
        writable: true,
      });
    }
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    // Loaded after the DOM globals exist; init is async even with bundled
    // resources, so wait for it before rendering translated labels.
    const config = await import("../features/i18n/config");
    for (let i = 0; i < 100 && !config.default.isInitialized; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(config.default.isInitialized).toBe(true);
  });

  beforeEach(() => {
    useGameStore.setState({
      settings: { ...defaultSettingsRecord },
      generation: { phase: "idle" },
      imageRegeneration: { phase: "idle" },
      autoplayTurn: { phase: "idle" },
    });
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container?.remove();
    container = null;
  });

  afterAll(() => {
    root?.unmount();
    root = null;
  });

  function dialog(): HTMLElement | null {
    return container?.querySelector<HTMLElement>('[role="dialog"]') ?? null;
  }

  async function mountDialog() {
    container = document.createElement("div");
    document.body.appendChild(container);
    const current = container;
    await act(async () => {
      root = createRoot(current);
      root.render(
        <MemoryRouter>
          <ErrorDialog />
        </MemoryRouter>,
      );
    });
  }

  test("a failed autoplay decision is shown and dismissed with a single button", async () => {
    useGameStore.setState({
      autoplayTurn: {
        phase: "failed",
        payload: { kind: "decision" },
        error: new Error("Model setting is invalid."),
      },
    });
    await mountDialog();

    const shown = dialog();
    expect(shown).not.toBeNull();
    expect(shown?.textContent).toContain("Model setting is invalid.");
    // No decision payload to re-run: exactly one button (Dismiss).
    const buttons = shown!.querySelectorAll("button");
    expect(buttons.length).toBe(1);

    await act(async () => {
      buttons[0]!.click();
    });
    expect(useGameStore.getState().autoplayTurn.phase).toBe("idle");
    expect(dialog()).toBeNull();
  });

  test("a failed generation still offers Retry", async () => {
    useGameStore.setState({
      generation: {
        phase: "failed",
        payload: { kind: "choice", choiceText: "open the door" },
        error: new Error("Model setting is invalid."),
      },
    });
    await mountDialog();

    const shown = dialog();
    expect(shown).not.toBeNull();
    // Retry + Start over + Dismiss.
    expect(shown!.querySelectorAll("button").length).toBe(3);
  });
});

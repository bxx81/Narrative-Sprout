import { describe, test, expect, beforeAll, afterEach, afterAll } from "bun:test";
import { Window } from "happy-dom";
import { act, useCallback, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import GameChoices from "./GameChoices";

// Models the real GameScreen lifecycle: the preset signal lives in the
// (persistent) parent, while GameChoices itself unmounts during each
// generation (skeleton) and remounts for the new scene. The custom input
// must end up empty instead of resurrecting a stale preset.

const harnessControl: {
  setPreset?: (preset: { choice: string } | undefined) => void;
  setChoicesMounted?: (mounted: boolean) => void;
  setViewingNodeId?: (id: string) => void;
} = {};

function Harness() {
  const [preset, setPreset] = useState<{ choice: string } | undefined>(undefined);
  const [choicesMounted, setChoicesMounted] = useState(true);
  const [viewingNodeId, setViewingNodeId] = useState("node-1");
  harnessControl.setPreset = setPreset;
  harnessControl.setChoicesMounted = setChoicesMounted;
  harnessControl.setViewingNodeId = setViewingNodeId;
  const handleConsumed = useCallback(() => setPreset(undefined), []);
  if (!choicesMounted) return <div data-testid="skeleton" />;
  return (
    <GameChoices
      choices={["go left", "go right"]}
      isCurrentStoryOver={false}
      loading={false}
      onChoiceSubmit={() => {}}
      onRestart={() => {}}
      viewingNodeId={viewingNodeId}
      choicePreset={preset}
      onChoicePresetConsumed={handleConsumed}
    />
  );
}

describe("GameChoices custom-choice-input", () => {
  let root: Root | null = null;
  let container: HTMLElement | null = null;

  beforeAll(() => {
    const win = new Window();
    for (const key of ["window", "document", "navigator"] as const) {
      Object.defineProperty(globalThis, key, {
        value: key === "document" ? win.document : key === "window" ? win : win.navigator,
        configurable: true,
        writable: true,
      });
    }
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

  function inputValue(): string {
    const input = container?.querySelector<HTMLInputElement>("#custom-choice-input");
    if (!input) throw new Error("custom-choice-input not found");
    return input.value;
  }

  async function mountHarness() {
    container = document.createElement("div");
    document.body.appendChild(container);
    const current = container;
    await act(async () => {
      root = createRoot(current);
      root.render(<Harness />);
    });
  }

  /** Flushes the deferred preset application (Promise.resolve().then(...)). */
  async function flushPreset() {
    await act(async () => {
      await Promise.resolve();
    });
  }

  async function applyPreset(choice: string) {
    await act(async () => {
      harnessControl.setPreset?.({ choice });
    });
    await flushPreset();
  }

  test("preset fills the input on arrival", async () => {
    await mountHarness();
    expect(inputValue()).toBe("");
    await applyPreset("sneak past");
    expect(inputValue()).toBe("sneak past");
  });

  test("successful generation clears the input without resurrecting the preset", async () => {
    await mountHarness();
    // Long-press flow: preset arrives and fills the input.
    await applyPreset("sneak past");
    expect(inputValue()).toBe("sneak past");

    // Generation succeeds: GameChoices unmounts (skeleton) and remounts
    // for the new scene. The parent still holds the same preset object
    // unless the child consumed it.
    await act(async () => {
      harnessControl.setChoicesMounted?.(false);
    });
    await act(async () => {
      harnessControl.setViewingNodeId?.("node-2");
      harnessControl.setChoicesMounted?.(true);
    });
    await flushPreset();
    expect(inputValue()).toBe("");
  });

  test("viewing-only navigation keeps the input", async () => {
    await mountHarness();
    await applyPreset("sneak past");
    expect(inputValue()).toBe("sneak past");

    // Back/Forward only moves viewingNodeId: no unmount.
    await act(async () => {
      harnessControl.setViewingNodeId?.("node-0");
    });
    await flushPreset();
    expect(inputValue()).toBe("sneak past");
  });
});

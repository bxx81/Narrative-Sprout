import { describe, test, expect, beforeAll, afterEach, afterAll } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useGameStore } from "../store/gameStore";
import { useGameNavigation } from "./useGameNavigation";
import type { GameRecord, StoryNodeRecord } from "../types";

// Renders the real hook against the real store (happy-dom), then drives the
// exact state transitions the History screen performs.

let seq = 0;
function makeNode(parentNodeId: string | null, turnNumber: number): StoryNodeRecord {
  seq += 1;
  return {
    id: `node-${seq}` as StoryNodeRecord["id"],
    gameId: "game-1" as StoryNodeRecord["gameId"],
    parentNodeId: (parentNodeId as StoryNodeRecord["parentNodeId"]) ?? null,
    turnNumber,
    choiceText: parentNodeId ? `choice ${seq}` : null,
    scene: {
      reasoning: "",
      sceneText: `scene ${seq}`,
      sceneWordCount: 2,
      imagePrompt: "img",
      negativeImagePrompt: "",
      choices: ["a", "b", "c"],
      isStoryOver: false,
      storyClosingText: "",
      locationContext: "",
    },
    promptSent: "p",
    memory: { notes: {}, storyLog: [] },
    memoryDelta: { notes: {}, sceneSummary: "s" },
    metadata: {
      generationCost: null,
      modelName: null,
      discardHistoryContext: false,
      refinePrompt: null,
      refinedFromNodeId: null,
    },
    createdAt: new Date(2026, 0, seq).toISOString(),
  };
}

describe("useGameNavigation (rendered)", () => {
  let root: Root | null = null;
  let container: HTMLElement;

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

  afterAll(() => {
    root?.unmount();
    root = null;
  });

  afterEach(async () => {
    // Unmount between tests: every Probe subscribes to the same store, and a
    // leftover probe would receive the next test's setState outside act().
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container?.remove();
  });

  async function renderProbe() {
    let captured!: ReturnType<typeof useGameNavigation>;
    function Probe() {
      captured = useGameNavigation();
      return null;
    }
    container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      root = createRoot(container);
      root.render(<Probe />);
    });
    return () => captured;
  }

  test("History -> Resume Here on a leaf: Back enabled, Forward disabled, latest = that leaf", async () => {
    // R -> M -> { L1, L2 }, previously playing branch 1 (latest = L1)
    const rootNode = makeNode(null, 1);
    const mid = makeNode(rootNode.id, 2);
    const leaf1 = makeNode(mid.id, 3);
    const leaf2 = makeNode(mid.id, 3);
    const game = {
      id: "game-1",
      latestNodeId: leaf1.id,
    } as GameRecord;

    const getNav = await renderProbe();

    // Resume Here on leaf2 (History card): viewing = leaf2, playhead = leaf2
    await act(async () => {
      useGameStore.setState({
        activeGame: game,
        nodes: [rootNode, mid, leaf1, leaf2],
        viewingNodeId: leaf2.id,
        currentNodeId: leaf2.id,
      });
    });

    let nav = getNav();
    expect(nav.canGoBack).toBe(true);
    expect(nav.canGoForward).toBe(false);
    expect(nav.isAtLatest).toBe(true);

    // Back walks up the resumed branch
    await act(async () => {
      nav.onNavigateBack();
    });
    nav = getNav();
    expect(useGameStore.getState().viewingNodeId).toBe(mid.id);
    expect(nav.canGoBack).toBe(true);
    expect(nav.canGoForward).toBe(true);

    // Forward returns toward the branch end
    await act(async () => {
      nav.onNavigateForward();
    });
    nav = getNav();
    expect(useGameStore.getState().viewingNodeId).toBe(leaf2.id);
    expect(nav.canGoForward).toBe(false);
  });

  test("viewing off the playhead path: both disabled, latest jumps to the playhead", async () => {
    const rootNode = makeNode(null, 1);
    const midA = makeNode(rootNode.id, 2);
    const leafA = makeNode(midA.id, 3);
    const midB = makeNode(rootNode.id, 2);
    const leafB = makeNode(midB.id, 3);
    const game = { id: "game-1", latestNodeId: leafA.id } as GameRecord;

    const getNav = await renderProbe();

    // If the playhead were NOT moved by Resume Here (stale currentNodeId at
    // branch A's end) while viewing sits on branch B, the buttons must be
    // disabled and "latest" must land on the playhead (branch A end).
    await act(async () => {
      useGameStore.setState({
        activeGame: game,
        nodes: [rootNode, midA, leafA, midB, leafB],
        viewingNodeId: leafB.id,
        currentNodeId: leafA.id,
      });
    });

    const nav = getNav();
    expect(nav.canGoBack).toBe(false);
    expect(nav.canGoForward).toBe(false);
    expect(nav.isAtLatest).toBe(false);

    await act(async () => {
      nav.onGoToLatest();
    });
    expect(useGameStore.getState().viewingNodeId).toBe(leafA.id);
  });

  test("mid-branch viewing with the playhead at the branch end: both enabled", async () => {
    const rootNode = makeNode(null, 1);
    const mid = makeNode(rootNode.id, 2);
    const leaf = makeNode(mid.id, 3);
    const game = { id: "game-1", latestNodeId: leaf.id } as GameRecord;

    const getNav = await renderProbe();

    // Chronicle "Resume Here" on mid with the branch end as playhead
    await act(async () => {
      useGameStore.setState({
        activeGame: game,
        nodes: [rootNode, mid, leaf],
        viewingNodeId: mid.id,
        currentNodeId: leaf.id,
      });
    });

    const nav = getNav();
    expect(nav.canGoBack).toBe(true);
    expect(nav.canGoForward).toBe(true);
    expect(nav.isAtLatest).toBe(false);
  });
});

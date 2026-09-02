import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { db } from "../db/database";
import { useGameStore } from "./gameStore";
import { defaultSettingsRecord } from "../types";

/**
 * The global enableStreaming setting must select the API delivery mode, not
 * just the display: with streaming off the request body carries NO `stream`
 * field, with it on the body is `stream: true` (legacy beginStream contract).
 */

const narratorContent = JSON.stringify({
  sceneText: "The scene unfolds.",
  locationContext: null,
  imagePrompt: "a quiet street",
  negativeImagePrompt: null,
  choice1: "go left",
  choice2: "go right",
  choice3: "wait",
  isStoryOver: false,
  finalEndingPassage: "",
  sceneSummary: "an ordinary street",
  notes: {},
});

const capturedBodies: Record<string, unknown>[] = [];
const realFetch = globalThis.fetch;

// The stub parses the request body (init.body) so the test can assert on it.
function stubCapturingFetch(): void {
  capturedBodies.length = 0;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof init?.body === "string" ? init.body : "";
    try {
      capturedBodies.push(JSON.parse(raw) as Record<string, unknown>);
    } catch {
      capturedBodies.push({});
    }
    return new Response(
      JSON.stringify({
        model: "test-model",
        choices: [{ message: { content: narratorContent }, finish_reason: "stop" }],
        usage: { cost: 0.01 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
}

describe("gameStore streaming delivery mode", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    useGameStore.setState({
      activeGame: null,
      nodes: [],
      generation: { phase: "idle" },
    });
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("enableStreaming=false sends a non-streamed request body", async () => {
    stubCapturingFetch();
    useGameStore.setState({
      settings: { ...defaultSettingsRecord, enableStreaming: false },
      openrouterApiKey: "sk-or-test",
    });
    await useGameStore.getState().startNewGame("a quiet town");
    expect(useGameStore.getState().generation.phase).toBe("idle");
    const requestBody = capturedBodies.find((body) => "messages" in body);
    expect(requestBody).toBeDefined();
    expect("stream" in requestBody!).toBe(false);
  });

  test("enableStreaming=true sends stream:true with usage inclusion", async () => {
    stubCapturingFetch();
    useGameStore.setState({
      settings: { ...defaultSettingsRecord, enableStreaming: true },
      openrouterApiKey: "sk-or-test",
    });
    await useGameStore.getState().startNewGame("a quiet town");
    expect(useGameStore.getState().generation.phase).toBe("idle");
    const requestBody = capturedBodies.find((body) => "messages" in body);
    expect(requestBody).toBeDefined();
    expect(requestBody!.stream).toBe(true);
  });
});

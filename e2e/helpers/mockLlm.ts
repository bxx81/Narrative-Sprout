import type { Page } from "@playwright/test";

/**
 * Canned OpenRouter chat-completions endpoint. The app's streaming client
 * accepts a plain JSON completion when the response is not an event
 * stream, so no SSE framing is needed — one queued scene per call.
 */
export interface MockScene {
  sceneText: string;
  choices: [string, string, string];
}

function toWireResponse(scene: MockScene, turnLabel: string): Record<string, unknown> {
  return {
    sceneText: scene.sceneText,
    locationContext: "E2E lighthouse",
    imagePrompt: "a lighthouse",
    negativeImagePrompt: null,
    choice1: scene.choices[0],
    choice2: scene.choices[1],
    choice3: scene.choices[2],
    isStoryOver: false,
    finalEndingPassage: "",
    sceneSummary: `${turnLabel} summary`,
    notes: {},
  };
}

export async function mockChatCompletions(
  page: Page,
  scenes: MockScene[],
  options?: { firstCallDelayMs?: number },
): Promise<{ callCount: () => number }> {
  let calls = 0;
  await page.route("https://openrouter.ai/api/v1/chat/completions", async (route) => {
    calls += 1;
    if (calls === 1 && options?.firstCallDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.firstCallDelayMs));
    }
    const scene = scenes[Math.min(calls, scenes.length) - 1];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        model: "e2e-mock",
        choices: [{ message: { content: JSON.stringify(toWireResponse(scene, `turn ${calls}`)) } }],
        usage: { total_tokens: 10 },
      }),
    });
  });
  return { callCount: () => calls };
}

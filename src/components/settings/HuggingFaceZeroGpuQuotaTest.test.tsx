import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import HuggingFaceZeroGpuQuotaTest from "./HuggingFaceZeroGpuQuotaTest";

// The run counts are what Hugging Face actually enforces: the GPU-second
// quota can still read as "time remaining" while every run of the window
// is already spent, which is exactly the failure the user sees at
// generation time. The test result must show used/limit/remaining runs
// (and say so loudly at zero) instead of the GPU-second figure alone.

const exhaustedQuota = {
  base: 300,
  current: 275.908465,
  resetsAt: "2026-09-27T19:49:23.783Z",
  overquotaUsed: 0,
  runs: { used: 8, limit: 8, remaining: 0, resetsAt: "2026-09-27T19:49:26.783Z" },
};

const availableQuota = {
  base: 300,
  current: 288,
  resetsAt: null,
  runs: { used: 1, limit: 8, remaining: 7, resetsAt: "2026-09-27T19:49:26.783Z" },
};

describe("HuggingFaceZeroGpuQuotaTest run counts", () => {
  let root: Root | null = null;
  let container: HTMLElement | null = null;
  let nextQuota: unknown = exhaustedQuota;
  const realFetch = globalThis.fetch;

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
    const config = await import("../../features/i18n/config");
    for (let i = 0; i < 100 && !config.default.isInitialized; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(config.default.isInitialized).toBe(true);
  });

  beforeEach(() => {
    nextQuota = exhaustedQuota;
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify(nextQuota), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )) as unknown as typeof fetch;
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
    globalThis.fetch = realFetch;
    root?.unmount();
    root = null;
  });

  function statusText(): string {
    return container?.querySelector<HTMLElement>('[role="status"]')?.textContent ?? "";
  }

  async function runQuotaTest(token = "hf-test") {
    container = document.createElement("div");
    document.body.appendChild(container);
    const current = container;
    await act(async () => {
      root = createRoot(current);
      root.render(<HuggingFaceZeroGpuQuotaTest token={token} />);
    });
    const button = container.querySelector<HTMLButtonElement>("button");
    if (!button) throw new Error("connection test button not found");
    await act(async () => {
      button.click();
    });
    const deadline = Date.now() + 2000;
    while (statusText().length === 0 && Date.now() < deadline) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    if (statusText().length === 0) throw new Error("quota result never rendered");
  }

  test("an exhausted run window is reported next to the GPU-second quota", async () => {
    await runQuotaTest();
    const shown = statusText();
    // The GPU-second figure alone reads as "still time left".
    expect(shown).toContain("275.9 / 300");
    expect(shown).toContain("8 of 8 used, 0 left");
    expect(shown).toContain("Run limit reached");
    // A missing translation key would render as the raw key.
    expect(shown).not.toContain("zeroGpuRuns");
  });

  test("an available run window shows used/limit without the exhausted warning", async () => {
    nextQuota = availableQuota;
    await runQuotaTest();
    const shown = statusText();
    expect(shown).toContain("1 of 8 used, 7 left");
    expect(shown).not.toContain("Run limit reached");
    // resetsAt: null must render the "not used yet" translation, not its key.
    expect(shown).toContain("quota has not been used yet");
    expect(shown).not.toContain("zeroGpuResets");
  });
});

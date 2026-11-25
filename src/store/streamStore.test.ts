import { describe, test, expect, afterEach } from "bun:test";
import { scanSceneText, streamStore } from "./streamStore";

const waitForFlush = () => new Promise((resolve) => setTimeout(resolve, 150));

describe("scanSceneText (partial JSON extraction)", () => {
  test("returns empty when the key has not arrived yet", () => {
    expect(scanSceneText('{"scene')).toEqual({ text: "", complete: false, keyStart: -1 });
    expect(scanSceneText("")).toEqual({ text: "", complete: false, keyStart: -1 });
  });

  test("extracts the partial value while still streaming", () => {
    const raw = '{"sceneText": "The knight opens the do';
    expect(scanSceneText(raw)).toEqual({
      text: "The knight opens the do",
      complete: false,
      keyStart: 1,
    });
  });

  test("reports complete once the closing quote arrives", () => {
    const raw = '{"sceneText": "Done.", "choice1": "a"}';
    expect(scanSceneText(raw)).toEqual({ text: "Done.", complete: true, keyStart: 1 });
  });

  test("decodes escape sequences", () => {
    const raw = '{"sceneText":"line1\\nline2 \\"quoted\\" \\\\ \\/ \\t \\u0041"}';
    const result = scanSceneText(raw);
    expect(result.complete).toBe(true);
    expect(result.text).toBe('line1\nline2 "quoted" \\ / \t A');
  });

  test("adopts the LAST occurrence of the key", () => {
    const raw = '{"sceneText":"first", "other":{"sceneText":"second"}}';
    const result = scanSceneText(raw);
    expect(result.text).toBe("second");
    expect(result.keyStart).toBe(raw.lastIndexOf('"sceneText"'));
  });
});

describe("streamStore sceneTextKeyStart", () => {
  afterEach(() => {
    streamStore.end();
  });

  test("reports the adopted key offset while streaming", async () => {
    streamStore.begin(true);
    streamStore.pushDelta('{"sceneText":"Hel');
    await waitForFlush();

    expect(streamStore.getSnapshot().sceneText).toBe("Hel");
    expect(streamStore.getSnapshot().sceneTextKeyStart).toBe(1);
  });

  test("moves the key offset when a later occurrence restarts the preview", async () => {
    streamStore.begin(true);
    streamStore.pushDelta('{"sceneText":"draft');
    await waitForFlush();
    const draftKeyStart = streamStore.getSnapshot().sceneTextKeyStart;
    expect(draftKeyStart).toBe(1);

    const raw = '{"sceneText":"draft"}\n{"sceneText":"real';
    streamStore.pushDelta(raw);
    await waitForFlush();

    expect(streamStore.getSnapshot().sceneText).toBe("real");
    expect(streamStore.getSnapshot().sceneTextKeyStart).toBe(raw.lastIndexOf('"sceneText"'));
    expect(streamStore.getSnapshot().sceneTextKeyStart).toBeGreaterThan(draftKeyStart);
  });

  test("moves the key offset when the replacement value starts empty", async () => {
    streamStore.begin(true);
    streamStore.pushDelta('{"sceneText":"draft"}');
    await waitForFlush();
    const draftKeyStart = streamStore.getSnapshot().sceneTextKeyStart;

    const raw = '{"sceneText":"draft"}\n{"sceneText":"';
    streamStore.pushDelta(raw);
    await waitForFlush();

    expect(streamStore.getSnapshot().sceneText).toBe("");
    expect(streamStore.getSnapshot().sceneTextKeyStart).toBe(raw.lastIndexOf('"sceneText"'));
    expect(streamStore.getSnapshot().sceneTextKeyStart).toBeGreaterThan(draftKeyStart);
  });

  test("begin resets the key offset", async () => {
    streamStore.begin(true);
    streamStore.pushDelta('{"sceneText":"draft"}');
    await waitForFlush();
    expect(streamStore.getSnapshot().sceneTextKeyStart).toBeGreaterThanOrEqual(0);

    streamStore.begin(true);
    expect(streamStore.getSnapshot().sceneTextKeyStart).toBe(-1);
  });
});

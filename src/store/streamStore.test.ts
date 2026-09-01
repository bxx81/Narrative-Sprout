import { describe, test, expect } from "bun:test";
import { scanSceneText } from "./streamStore";

describe("scanSceneText (partial JSON extraction)", () => {
  test("returns empty when the key has not arrived yet", () => {
    expect(scanSceneText('{"scene')).toEqual({ text: "", complete: false });
    expect(scanSceneText("")).toEqual({ text: "", complete: false });
  });

  test("extracts the partial value while still streaming", () => {
    const raw = '{"sceneText": "The knight opens the do';
    expect(scanSceneText(raw)).toEqual({ text: "The knight opens the do", complete: false });
  });

  test("reports complete once the closing quote arrives", () => {
    const raw = '{"sceneText": "Done.", "choice1": "a"}';
    expect(scanSceneText(raw)).toEqual({ text: "Done.", complete: true });
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
  });
});

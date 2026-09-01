import { describe, expect, test } from "bun:test";
import { processAttachmentContents } from "./attachmentProcessor";

describe("processAttachmentContents", () => {
  test("extracts theme from first scenario file and keeps body as attachment", () => {
    const files = [
      { name: "scenario.md", content: `---\ntheme: Custom Theme\n---\nAttachment body` },
      { name: "note.txt", content: "plain note" },
    ];
    const result = processAttachmentContents(files, "baseTheme");
    expect(result.theme).toBe("Custom Theme");
    expect(result.attachmentTexts).toHaveLength(2);
    expect(result.attachmentTexts[0]).toContain("Attachment body");
    expect(result.attachmentTexts[1]).toContain("plain note");
  });

  test("ignores second scenario file's theme, treats its body as attachment", () => {
    const files = [
      { name: "a.md", content: `---\ntheme: First\n---\nbody1` },
      { name: "b.md", content: `---\ntheme: Second\n---\nbody2` },
    ];
    const result = processAttachmentContents(files, "base");
    expect(result.theme).toBe("First");
    expect(result.attachmentTexts.join("")).toContain("body2");
    expect(result.theme).not.toBe("Second");
  });

  test("falls back to baseTheme when no scenario file", () => {
    const files = [{ name: "note.txt", content: "hello" }];
    const result = processAttachmentContents(files, "fallback");
    expect(result.theme).toBe("fallback");
  });

  test("decodes .b64 files before processing", () => {
    const b64 = Buffer.from("b64 body {a|b}").toString("base64");
    const files = [{ name: "data.b64", content: b64 }];
    const result = processAttachmentContents(files, "base");
    expect(result.attachmentTexts).toHaveLength(1);
    // random choice should have been applied (a or b)
    expect(result.attachmentTexts[0]).toMatch(/b64 body (a|b)/);
  });

  test("skips empty files and unsupported extensions", () => {
    const files = [
      { name: "empty.txt", content: "" },
      { name: "image.png", content: "not relevant" },
      { name: "note.txt", content: "keep" },
    ];
    const result = processAttachmentContents(files, "base");
    expect(result.attachmentTexts).toHaveLength(1);
    expect(result.attachmentTexts[0]).toContain("keep");
  });

  test("applies random choice to each file", () => {
    const files = [{ name: "a.md", content: "{x|y|z}" }];
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const r = processAttachmentContents(files, "base");
      // body is wrapped: "--- Attachment: a.md ---\n<x>\n--- End Attachment ---"
      const body = r.attachmentTexts[0].split("\n")[1] ?? "";
      seen.add(body.trim());
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  test("wraps attachments with header", () => {
    const files = [{ name: "a.txt", content: "hello" }];
    const result = processAttachmentContents(files, "base");
    expect(result.attachmentTexts[0]).toContain("--- Attachment: a.txt ---");
  });

  test("handles scenario file with empty body (theme only)", () => {
    const files = [{ name: "scenario.md", content: `---\ntheme: OnlyTheme\n---\n` }];
    const result = processAttachmentContents(files, "base");
    expect(result.theme).toBe("OnlyTheme");
    expect(result.attachmentTexts).toHaveLength(0);
  });
});

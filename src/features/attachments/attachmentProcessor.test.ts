import { describe, expect, test } from "bun:test";
import { processAttachmentContents, readScenarioFile } from "./attachmentProcessor";

describe("processAttachmentContents", () => {
  test("keeps the form theme while a scenario file only contributes its body", () => {
    const files = [
      { name: "scenario.md", content: `---\ntheme: File Theme\n---\nAttachment body` },
      { name: "note.txt", content: "plain note" },
    ];
    const result = processAttachmentContents(files, "baseTheme");
    expect(result.theme).toBe("baseTheme");
    expect(result.attachmentTexts).toHaveLength(2);
    expect(result.attachmentTexts[0]).toContain("Attachment body");
    expect(result.attachmentTexts[0]).not.toContain("File Theme");
    expect(result.attachmentTexts[1]).toContain("plain note");
  });

  test("never lets any front-matter theme reach the game theme", () => {
    const files = [
      { name: "a.md", content: `---\ntheme: First\n---\nbody1` },
      { name: "b.md", content: `---\ntheme: Second\n---\nbody2` },
    ];
    const result = processAttachmentContents(files, "base");
    expect(result.theme).toBe("base");
    expect(result.attachmentTexts.join("")).toContain("body1");
    expect(result.attachmentTexts.join("")).toContain("body2");
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

  test("scenario file with empty body (theme only) adds no attachment text", () => {
    const files = [{ name: "scenario.md", content: `---\ntheme: OnlyTheme\n---\n` }];
    const result = processAttachmentContents(files, "base");
    expect(result.theme).toBe("base");
    expect(result.attachmentTexts).toHaveLength(0);
  });

  test("applies random choice to base theme", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const result = processAttachmentContents([], "A {cat|dog} tale");
      expect(result.theme).not.toContain("{");
      seen.add(result.theme);
    }
    expect(seen).toEqual(new Set(["A cat tale", "A dog tale"]));
  });

  test("a front-matter theme with {a|b} never resolves into the game theme", () => {
    const files = [{ name: "scenario.md", content: `---\ntheme: The {red|blue} door\n---\nbody` }];
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      seen.add(processAttachmentContents(files, "base").theme);
    }
    expect(seen).toEqual(new Set(["base"]));
  });
});

describe("readScenarioFile", () => {
  test("parses front matter from .txt/.md", async () => {
    const parsed = await readScenarioFile(
      new File([`---\ntheme: From File\n---\nbody`], "scenario.md"),
    );
    expect(parsed?.theme).toBe("From File");
    expect(parsed?.body).toBe("body");
  });

  test("decodes .b64 first so it parses exactly like .txt/.md", async () => {
    const raw = `---\ntheme: Encoded\n---\nbody`;
    const parsed = await readScenarioFile(
      new File([Buffer.from(raw).toString("base64")], "scenario.b64"),
    );
    expect(parsed?.theme).toBe("Encoded");
    expect(parsed?.body).toBe("body");
  });

  test("returns null for non-text attachments", async () => {
    expect(await readScenarioFile(new File(["binary"], "image.png"))).toBeNull();
  });

  test("returns null for undecodable .b64", async () => {
    expect(await readScenarioFile(new File(["not base64 !!"], "broken.b64"))).toBeNull();
  });
});

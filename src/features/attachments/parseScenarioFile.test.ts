import { describe, expect, test } from "bun:test";
import { parseScenarioFile } from "./parseScenarioFile";

describe("parseScenarioFile", () => {
  test("extracts theme and body when front matter contains theme", () => {
    const content = `---
title: Test
theme: |
  My world
  second line
---
Body here`;
    const parsed = parseScenarioFile(content);
    expect(parsed.theme).toBe("My world\nsecond line\n");
    expect(parsed.body).toBe("Body here");
  });

  test("returns theme null when no front matter", () => {
    const content = "just body\n---\nhorizontal";
    const parsed = parseScenarioFile(content);
    expect(parsed.theme).toBeNull();
    expect(parsed.body).toBe(content);
  });

  test("does not confuse markdown horizontal rule in body", () => {
    const content = `---
theme: A
---
line1
---
line2`;
    const parsed = parseScenarioFile(content);
    expect(parsed.theme).toBe("A");
    expect(parsed.body).toBe("line1\n---\nline2");
  });

  test("treats missing closing delimiter as plain attachment", () => {
    const content = `---
theme: A
body without close`;
    const parsed = parseScenarioFile(content);
    expect(parsed.theme).toBeNull();
    expect(parsed.body).toBe(content);
  });

  test("returns warning and falls back on invalid YAML", () => {
    const content = `---
theme: [unclosed
---
body`;
    const parsed = parseScenarioFile(content);
    expect(parsed.theme).toBeNull();
    expect(parsed.body).toBe(content);
    expect(parsed.warning).toBeDefined();
  });

  test("ignores front matter without theme key", () => {
    const content = `---
title: Only title
---
actual body`;
    const parsed = parseScenarioFile(content);
    expect(parsed.theme).toBeNull();
    expect(parsed.body).toBe(content);
  });

  test("ignores non-string theme", () => {
    const content = `---
theme: 123
---
body`;
    const parsed = parseScenarioFile(content);
    expect(parsed.theme).toBeNull();
    expect(parsed.body).toBe(content);
  });

  test("handles empty body after front matter", () => {
    const content = `---
theme: My Theme
---
`;
    const parsed = parseScenarioFile(content);
    expect(parsed.theme).toBe("My Theme");
    expect(parsed.body).toBe("");
  });

  test("handles windows line endings", () => {
    const content = `---\r\ntheme: Win\r\n---\r\nbody\r\nnext`;
    const parsed = parseScenarioFile(content);
    expect(parsed.theme).toBe("Win");
    // body is normalized to LF after split/join
    expect(parsed.body).toBe("body\nnext");
  });
});

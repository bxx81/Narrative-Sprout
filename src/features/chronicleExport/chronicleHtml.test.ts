import { describe, expect, test } from "bun:test";
import { LOAD_SCREEN_FALLBACK_URL } from "../../components/game/imageFallbacks";
import { siteOrigin } from "../../lib/cloudFlarePages";
import { buildChronicleHtml, escapeHtml } from "./markup";
import type { ChronicleExportInput } from "./types";

function makeInput(overrides: Partial<ChronicleExportInput> = {}): ChronicleExportInput {
  return {
    htmlLanguage: "ja",
    direction: "ltr",
    chronicleTitle: "物語の記録",
    chronicleDescription: "説明文",
    historyChoicePrefix: "あなたの選択",
    sceneTextClass: "text-[18px]",
    choicesClass: "text-base",
    languageFontCssPath: "/s/ja.css",
    nodes: [
      {
        nodeId: "node-1",
        sceneText: "一行目\n**強調**\n---\n「セリフ」",
        storyClosingText: "",
        imagePrompt: "prompt",
        choiceText: "進む",
        imagePath: "images/node-1.webp",
      },
    ],
    ...overrides,
  };
}

describe("escapeHtml", () => {
  test("escapes every HTML-significant character", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#039;&lt;/a&gt;",
    );
  });
});

describe("buildChronicleHtml", () => {
  test("sets lang/dir and renders the title and description", () => {
    const html = buildChronicleHtml(makeInput(), "/*css*/");
    expect(html).toContain('<html lang="ja" dir="ltr">');
    expect(html).toContain("<title>物語の記録</title>");
    expect(html).toContain(
      '<h1 class="font-serif-display text-3xl font-bold md:text-4xl">物語の記録</h1>',
    );
    expect(html).toContain("説明文");
  });

  test("references fonts and the attribution link only from the deploy origin", () => {
    const html = buildChronicleHtml(makeInput(), "/*css*/");
    expect(html).toContain(`href="${siteOrigin}/s/en.css"`);
    expect(html).toContain(`href="${siteOrigin}/s/ja.css"`);
    expect(html).toContain(`href="${siteOrigin}/"`);

    // Every external URL left after stripping the deploy origin would be a
    // third-party read the requirements forbid.
    expect(html.split(siteOrigin).join("")).not.toContain("http");
  });

  test("English loads only the global stylesheet", () => {
    const html = buildChronicleHtml(
      makeInput({ htmlLanguage: "en", languageFontCssPath: null }),
      "/*css*/",
    );
    expect(html).toContain(`href="${siteOrigin}/s/en.css"`);
    expect(html).not.toContain("/s/ja.css");
  });

  test("supports right-to-left direction", () => {
    const html = buildChronicleHtml(makeInput({ direction: "rtl" }), "/*css*/");
    expect(html).toContain('<html lang="ja" dir="rtl">');
  });

  test("renders scene prose, bold spans, dividers and bracket indent", () => {
    const html = buildChronicleHtml(makeInput(), "/*css*/");
    expect(html).toContain(
      'class="main-text-prose space-y-8 text-[18px] leading-[2.2] whitespace-pre-wrap"',
    );
    expect(html).toContain('<p class="text-[18px]">一行目</p>');
    expect(html).toContain('<strong class="font-bold">強調</strong>');
    expect(html).toContain('<hr class="text-divider dividers-marker">');
    expect(html).toContain("bracket-start");
  });

  test("renders the choice echo from the next node with the localized prefix", () => {
    const html = buildChronicleHtml(makeInput(), "/*css*/");
    expect(html).toContain("あなたの選択");
    expect(html).toContain('<p class="font-semibold wrap-anywhere text-base">"進む"</p>');
  });

  test("uses the archive image path and falls back to the inline placeholder when absent", () => {
    const withImage = buildChronicleHtml(makeInput(), "/*css*/");
    expect(withImage).toContain('src="./images/node-1.webp"');

    const withoutImage = buildChronicleHtml(
      makeInput({
        nodes: [
          {
            nodeId: "node-1",
            sceneText: "text",
            storyClosingText: "",
            imagePrompt: "prompt",
            choiceText: null,
            imagePath: null,
          },
        ],
      }),
      "/*css*/",
    );
    expect(withoutImage).toContain(`src="${LOAD_SCREEN_FALLBACK_URL}"`);
  });

  test("contains no navigation controls (buttons / click handlers)", () => {
    const html = buildChronicleHtml(makeInput(), "/*css*/");
    expect(html).not.toContain("<button");
    expect(html.toLowerCase()).not.toContain("onclick");
    expect(html).not.toContain("onMenuClick");
    expect(html).not.toContain("Resume");
    expect(html).not.toContain("BackButton");
  });

  test("escapes untrusted scene text instead of emitting markup", () => {
    const html = buildChronicleHtml(
      makeInput({
        nodes: [
          {
            nodeId: "node-1",
            sceneText: "<script>alert(1)</script>",
            storyClosingText: "",
            imagePrompt: "<img>",
            choiceText: null,
            imagePath: null,
          },
        ],
      }),
      "/*css*/",
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain('alt="&lt;img&gt;"');
  });

  test("renders nodes in the given order", () => {
    const html = buildChronicleHtml(
      makeInput({
        nodes: [
          {
            nodeId: "node-1",
            sceneText: "FIRST_SCENE",
            storyClosingText: "",
            imagePrompt: "p",
            choiceText: "c",
            imagePath: null,
          },
          {
            nodeId: "node-2",
            sceneText: "SECOND_SCENE",
            storyClosingText: "",
            imagePrompt: "p",
            choiceText: null,
            imagePath: null,
          },
        ],
      }),
      "/*css*/",
    );
    expect(html.indexOf("FIRST_SCENE")).toBeLessThan(html.indexOf("SECOND_SCENE"));
  });
});

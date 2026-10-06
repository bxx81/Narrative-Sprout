/**
 * Standalone chronicle export (knowledge/features/story-export.md).
 *
 * Renders the branch shown on the chronicle screen into a single self-contained
 * `index.html` plus an `images/` folder, zipped for download. Only
 * `GameRecord` / `StoryNodeRecord` / `AssetRecord` data reaches the bundle —
 * settings and credentials are structurally excluded (AGENTS rule 3).
 *
 * The page has no navigation (no resume / back buttons, no image click), and
 * its only external requests are the self-hosted fonts on the deploy origin.
 */

/** One node card in the exported chronicle. */
export interface ChronicleExportNode {
  nodeId: string;
  sceneText: string;
  /** Non-empty only when the story concluded on this node. */
  storyClosingText: string;
  imagePrompt: string;
  /** The NEXT node's choice text (the choice that left this node), if any. */
  choiceText: string | null;
  /** ZIP-relative image path (e.g. `images/<nodeId>.webp`), or null when the node has no asset. */
  imagePath: string | null;
}

/** One image file to place in the archive. */
export interface ChronicleExportImage {
  /** ZIP-internal path; extension derived from the asset mimeType. */
  path: string;
  blob: Blob;
}

/** Everything the pure HTML builder needs. */
export interface ChronicleExportInput {
  /** IETF language tag written to `<html lang>`. */
  htmlLanguage: string;
  direction: "ltr" | "rtl";
  chronicleTitle: string;
  chronicleDescription: string;
  historyChoicePrefix: string;
  /** Tailwind text-size class for scene prose (from `GAME_TEXT_SIZE_CLASSES`). */
  sceneTextClass: string;
  /** Tailwind text-size class for the choice echo. */
  choicesClass: string;
  /** Deploy-relative font stylesheet path for the language, or null for English. */
  languageFontCssPath: string | null;
  nodes: ChronicleExportNode[];
}

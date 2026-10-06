import { strToU8, type Zippable } from "fflate";
import { GAME_TEXT_SIZE_CLASSES, resolveGameTextSize } from "../../lib/gameTextSize";
import { getImageFileExtension } from "../../lib/imageFileExtensions";
import { sanitizeFileName } from "../../lib/sanitizeFileName";
import { createZipBlob } from "../../lib/zipArchive";
import { getLanguageCode, getLanguageFontCssPath, isRightToLeftLanguage } from "../i18n/api";
import { collectAncestors } from "../storytree/api";
import type { GameRecord, SettingsRecord, StoryNodeRecord } from "../../types";
import type { AssetRecord } from "../../types/asset";
import { buildChronicleHtml } from "./markup";
import { chronicleExportCss } from "./generated/chronicleExportCss";
import type { ChronicleExportImage, ChronicleExportInput, ChronicleExportNode } from "./types";

/** Localized labels baked into the exported page. */
export interface ChronicleExportTranslation {
  chronicleTitle: string;
  chronicleDescription: string;
  historyChoicePrefix: string;
}

/** Everything the orchestrator reads (all from the in-memory active game). */
export interface ChronicleExportSource {
  game: GameRecord;
  /** All nodes of the active game (the branch is walked from these). */
  nodes: StoryNodeRecord[];
  /** nodeId -> asset for the active game. */
  assets: Record<string, AssetRecord>;
  /** The branch's end node (chronicle target / history card). */
  targetNodeId: string;
  settings: SettingsRecord;
  translation: ChronicleExportTranslation;
}

export interface ExportedChronicle {
  fileName: string;
  blob: Blob;
}

/**
 * Builds the standalone chronicle ZIP: `index.html` (self-contained except for
 * fonts loaded from the deploy origin) plus `images/<nodeId>.<ext>` for every
 * branch node that has an asset. Assets are stored uncompressed (already
 * compressed WebP); the HTML is deflated.
 */
export async function exportChronicleAsZip(
  source: ChronicleExportSource,
): Promise<ExportedChronicle> {
  const byId = new Map(source.nodes.map((node) => [node.id, node]));
  // collectAncestors returns target-first; the chronicle renders root-first.
  const branchPath = collectAncestors(byId, source.targetNodeId, true).reverse();

  const images: ChronicleExportImage[] = [];
  const exportNodes: ChronicleExportNode[] = branchPath.map((node, index) => {
    const nextNode = branchPath[index + 1];
    const asset = source.assets[node.id];
    let imagePath: string | null = null;
    if (asset) {
      imagePath = `images/${node.id}.${getImageFileExtension(asset.mimeType)}`;
      images.push({ path: imagePath, blob: asset.blob });
    }
    return {
      nodeId: node.id,
      sceneText: node.scene.sceneText,
      storyClosingText: node.scene.isStoryOver ? node.scene.storyClosingText : "",
      imagePrompt: node.scene.imagePrompt,
      choiceText: nextNode?.choiceText ?? null,
      imagePath,
    };
  });

  const languageCode = getLanguageCode(
    source.settings.uiLanguage,
    source.settings.aiLanguageMappings,
  );
  const textClasses = GAME_TEXT_SIZE_CLASSES[resolveGameTextSize(source.settings.gameTextSize)];
  const input: ChronicleExportInput = {
    htmlLanguage: languageCode,
    direction: isRightToLeftLanguage(languageCode) ? "rtl" : "ltr",
    chronicleTitle: source.translation.chronicleTitle,
    chronicleDescription: source.translation.chronicleDescription,
    historyChoicePrefix: source.translation.historyChoicePrefix,
    sceneTextClass: textClasses.sceneText,
    choicesClass: textClasses.choices,
    languageFontCssPath: getLanguageFontCssPath(languageCode),
    nodes: exportNodes,
  };

  const files: Zippable = { "index.html": strToU8(buildChronicleHtml(input, chronicleExportCss)) };
  for (const image of images) {
    const bytes = new Uint8Array(await image.blob.arrayBuffer());
    files[image.path] = [bytes, { level: 0 }];
  }

  return {
    fileName: buildChronicleExportFileName(source.game.title),
    blob: await createZipBlob(files),
  };
}

/** e.g. `ns-chronicle_黄昏の王国_2026-09-01-12-30-45.zip` */
function buildChronicleExportFileName(title: string): string {
  const safeTitle = sanitizeFileName(title).slice(0, 40) || "game";
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  return `ns-chronicle_${safeTitle}_${stamp}.zip`;
}

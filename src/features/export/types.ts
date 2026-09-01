import { z } from "zod";
import { gameRecordSchema } from "../../types/game";

/**
 * `ns-save` container (REDESIGN.md §5.5): a ZIP archive holding
 * `manifest.json` + `nodes/*.json` + `assets/<nodeId>.<extension>`.
 *
 * The container version is independent of the DB `schemaVersion` carried
 * inside the game record. Import code (future) must refuse versions it does
 * not know instead of guessing (non-destructive policy, §5.6).
 */

/** Format identifier written to manifest.json. */
export const NS_SAVE_FORMAT = "ns-save" as const;

/** Version of the ns-save container format. */
export const NS_SAVE_VERSION = 1;

export const nsSaveManifestSchema = z.object({
  format: z.literal(NS_SAVE_FORMAT),
  version: z.number().int().positive(),
  /** ISO 8601 timestamp of when the archive was created. */
  exportedAt: z.string(),
  /** Save header. Settings and credentials are structurally absent (§5.4). */
  game: gameRecordSchema,
});
export type NSaveManifest = z.infer<typeof nsSaveManifestSchema>;

/** One serialized StoryNodeRecord under `nodes/`. */
export interface ExportNodeFile {
  nodeId: string;
  /** ZIP-internal path, e.g. `nodes/<nodeId>.json`. */
  path: string;
  json: string;
}

/** One image under `assets/`. */
export interface ExportAssetFile {
  nodeId: string;
  /** ZIP-internal path; extension derived from mimeType (§5.3). */
  path: string;
  blob: Blob;
}

/** All files an ns-save archive contains, before archiving. */
export interface ExportBundle {
  manifest: NSaveManifest;
  nodeFiles: ExportNodeFile[];
  assetFiles: ExportAssetFile[];
}

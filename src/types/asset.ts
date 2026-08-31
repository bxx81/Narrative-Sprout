import { z } from "zod";
import type { ImageMimeType } from "../lib/imageFileExtensions";
import { storyNodeIdSchema } from "./ids";

/**
 * Image asset for a story node (REDESIGN.md §5.3).
 *
 * Keyed 1:1 by node id. Regeneration overwrites the same key. Node deletion
 * and asset deletion must happen in a single transaction.
 */
export const assetRecordSchema = z.object({
  /** Primary key — identical to the owning StoryNodeRecord's id. */
  nodeId: storyNodeIdSchema,
  blob: z.instanceof(Blob),
  mimeType: z.string(), // typed as ImageMimeType via the interface below
  byteSize: z.number().int().nonnegative(),
  /** Bumped on every overwrite (e.g. image regeneration). */
  updatedAt: z.string(), // ISO 8601
});

export interface AssetRecord extends Omit<z.infer<typeof assetRecordSchema>, "mimeType"> {
  mimeType: ImageMimeType;
}

/**
 * Branded ID types (REDESIGN.md §6).
 *
 * ID fields always name their target in full (`parentNodeId`, never
 * `parentId`). Branding prevents mixing up e.g. a GameId and a StoryNodeId.
 */
import { z } from "zod";

export const gameIdSchema = z.string().brand<"GameId">();
export type GameId = z.infer<typeof gameIdSchema>;

export const storyNodeIdSchema = z.string().brand<"StoryNodeId">();
export type StoryNodeId = z.infer<typeof storyNodeIdSchema>;

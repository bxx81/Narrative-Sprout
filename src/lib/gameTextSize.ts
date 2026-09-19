import type { GameTextSize } from "../types/settings";

/**
 * Body text size classes driven by the `gameTextSize` setting. The baseline
 * (`medium`) matches the legacy fixed sizes (scene 18px / choices
 * `text-base` / choice echo `text-sm`). The choice echo
 * (`displayChoiceText`) is always one step smaller than the choices buttons.
 */
export const GAME_TEXT_SIZE_CLASSES: Record<
  GameTextSize,
  { displayChoiceText: string; sceneText: string; choices: string }
> = {
  small: {
    displayChoiceText: "text-xs/relaxed",
    sceneText: "text-[16px]",
    choices: "text-sm",
  },
  medium: {
    displayChoiceText: "text-sm/relaxed",
    sceneText: "text-[18px]",
    choices: "text-base",
  },
  large: {
    displayChoiceText: "text-base/relaxed",
    sceneText: "text-[20px]",
    choices: "text-lg",
  },
  xlarge: {
    displayChoiceText: "text-lg/relaxed",
    sceneText: "text-[22px]",
    choices: "text-xl",
  },
};

export const resolveGameTextSize = (gameTextSize: GameTextSize | undefined): GameTextSize =>
  gameTextSize ?? "medium";

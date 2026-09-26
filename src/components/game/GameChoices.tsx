import React, { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import Button from "../ui/Button";
import { Icon } from "../ui/Icon";

/**
 * 長押し判定秒（ms）
 */
export const LongPressMs = 1000;

/** How far a pointer may wander during a press before it counts as a drag, not a long press. */
const LongPressMoveSlopPx = 10;

interface GameChoicesProps {
  choices: string[];
  isCurrentStoryOver: boolean;
  loading: boolean;
  onChoiceSubmit: (choice: string) => void;
  onRestart: () => void;
  viewingNodeId: string;
  choicePreset?: { choice: string };
  /**
   * Called once the preset has been applied to the input, so the parent can
   * discard the signal. Without this the stale signal would refill the input
   * on every remount (GameScreen swaps this component for a skeleton during
   * each generation), resurrecting submitted text.
   */
  onChoicePresetConsumed: () => void;
  /** Tailwind text-size class for the choice buttons and custom input. */
  choicesTextClass?: string;
}

const GameChoices: React.FC<GameChoicesProps> = ({
  choices,
  isCurrentStoryOver,
  loading,
  onChoiceSubmit,
  onRestart,
  viewingNodeId,
  choicePreset,
  onChoicePresetConsumed,
  choicesTextClass = "text-base",
}) => {
  const { t } = useTranslation();
  const [customChoice, setCustomChoice] = useState("");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Swallows the click the long press itself produces (or the synthesized one
  // a touch gesture ends with). Cleared on the next pointerdown, so a long
  // press that ends without a click reaching this button can never eat a
  // later, ordinary click.
  const suppressNextClickRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);

  const startLongPress = useCallback(
    (choice: string) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        suppressNextClickRef.current = true;
        setCustomChoice(choice);
        toast.success(t("toastChoiceCopied"));
      }, LongPressMs);
    },
    [t],
  );

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  /** Ends the active press: stops the timer and releases the pointer bookkeeping. */
  const endPointerPress = useCallback(
    (pointerId: number) => {
      cancelLongPress();
      if (activePointerIdRef.current === pointerId) {
        activePointerIdRef.current = null;
        pressOriginRef.current = null;
      }
    },
    [cancelLongPress],
  );

  useEffect(() => cancelLongPress, [cancelLongPress]);

  useEffect(() => {
    if (choicePreset) {
      Promise.resolve().then(() => {
        setCustomChoice(choicePreset.choice);
        onChoicePresetConsumed();
      });
    }
  }, [choicePreset, onChoicePresetConsumed]);

  const handleCustomChoiceSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customChoice.trim() || loading) return;
    onChoiceSubmit(customChoice.trim());
    setCustomChoice("");
  };

  return (
    <div>
      <div>
        {isCurrentStoryOver ? (
          <div className="mt-4 flex items-center justify-center">
            <Button onClick={onRestart} intent="primary" size="large">
              {t("playAgainButton")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {choices.map((choice, index) => (
              <button
                key={choice ? `${viewingNodeId}:${choice}` : `${viewingNodeId}:${index}`}
                onClick={() => {
                  if (suppressNextClickRef.current) {
                    suppressNextClickRef.current = false;
                    return;
                  }
                  if (choice != "") onChoiceSubmit(choice);
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0 || !e.isPrimary) return;
                  suppressNextClickRef.current = false;
                  activePointerIdRef.current = e.pointerId;
                  pressOriginRef.current = { x: e.clientX, y: e.clientY };
                  startLongPress(choice);
                }}
                onPointerMove={(e) => {
                  if (activePointerIdRef.current !== e.pointerId || !pressOriginRef.current) return;
                  const wanderX = e.clientX - pressOriginRef.current.x;
                  const wanderY = e.clientY - pressOriginRef.current.y;
                  if (Math.hypot(wanderX, wanderY) > LongPressMoveSlopPx) {
                    endPointerPress(e.pointerId);
                  }
                }}
                onPointerUp={(e) => endPointerPress(e.pointerId)}
                onPointerCancel={(e) => endPointerPress(e.pointerId)}
                onPointerLeave={(e) => endPointerPress(e.pointerId)}
                disabled={loading}
                className={`choice-style ${choicesTextClass} ${
                  choice != "" ? `cursor-pointer disabled:cursor-default` : "text-text-disable"
                }`}
              >
                {`> ${choice}`}
              </button>
            ))}
            <form
              onSubmit={handleCustomChoiceSubmit}
              className={`choice-form-style ${!loading ? "border-border" : "border-border/0"}`}
            >
              <label htmlFor="custom-choice-input" className="sr-only">
                {t("customChoicePlaceholder")}
              </label>
              <input
                id="custom-choice-input"
                type="text"
                value={customChoice}
                onChange={(e) => setCustomChoice(e.target.value)}
                placeholder={t("customChoicePlaceholder")}
                disabled={loading}
                className={`choice-input ${choicesTextClass}`}
              />
              <button
                type="submit"
                disabled={loading || !customChoice.trim()}
                aria-label={t("submitCustomActionLabel")}
                className={`choice-button ${loading ? "opacity-0" : ""}`}
              >
                <div className="flex items-center justify-center">
                  <Icon iconName="send" />
                </div>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameChoices;

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";
import { Icon } from "../ui/Icon";

/**
 * 長押し判定秒（ms）
 */
export const LongPressMs = 1000;

interface GameChoicesProps {
  choices: string[];
  isCurrentStoryOver: boolean;
  loading: boolean;
  onChoiceSubmit: (choice: string) => void;
  onRestart: () => void;
  viewingNodeId: string;
  choicePreset?: { choice: string };
}

const GameChoices: React.FC<GameChoicesProps> = ({
  choices,
  isCurrentStoryOver,
  loading,
  onChoiceSubmit,
  onRestart,
  viewingNodeId,
  choicePreset,
}) => {
  const { t } = useTranslation();
  const [customChoice, setCustomChoice] = useState("");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const startLongPress = useCallback((choice: string) => {
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setCustomChoice(choice);
    }, LongPressMs);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (choicePreset) {
      Promise.resolve().then(() => {
        setCustomChoice(choicePreset.choice);
      });
    }
  }, [choicePreset]);

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
                  if (longPressTriggered.current) {
                    longPressTriggered.current = false;
                    return;
                  }
                  if (choice != "") onChoiceSubmit(choice);
                }}
                onMouseDown={() => startLongPress(choice)}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                onTouchStart={() => startLongPress(choice)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                disabled={loading}
                className={`choice-style ${choice != "" ? "cursor-pointer disabled:cursor-default" : "text-text-disable"}`}
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
                className="choice-input"
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

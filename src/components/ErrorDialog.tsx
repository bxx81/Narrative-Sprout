import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../store/gameStore";
import { classifyError } from "../lib/errorClassification";
import { playSound } from "../features/sound/api";
import { ROUTES } from "../app/routes";
import Button from "./ui/Button";

const MAX_VISIBLE_LINES = 7;

/**
 * Global error dialog (legacy ErrorDisplay, modal variant): shown whenever
 * the generation or image operation sits in the failed phase. Retryable
 * failures offer Retry (re-runs the retained payload) and Start Over; a 429
 * with `settings.autoRetrySeconds > 0` retries automatically on a countdown.
 * User aborts are informational and offer only Dismiss.
 */
const ErrorDialog: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const generation = useGameStore((s) => s.generation);
  const imageRegeneration = useGameStore((s) => s.imageRegeneration);
  const autoRetrySeconds = useGameStore((s) => s.settings?.autoRetrySeconds ?? 0);
  const retryGeneration = useGameStore((s) => s.retryGeneration);
  const dismissError = useGameStore((s) => s.dismissError);
  const goToTitle = useGameStore((s) => s.goToTitle);

  const failedGeneration = generation.phase === "failed" ? generation : null;
  const failedImage =
    !failedGeneration && imageRegeneration.phase === "failed" ? imageRegeneration : null;
  const failedPayload = failedGeneration?.payload ?? failedImage?.payload ?? null;
  const classified = failedGeneration
    ? classifyError(failedGeneration.error)
    : failedImage
      ? classifyError(failedImage.error)
      : null;

  const isOpen = classified !== null;

  // Error chime: fires when the dialog opens and again only when a fresh
  // failure replaces the shown payload (each failure creates a new payload).
  const announcedPayloadRef = useRef<typeof failedPayload>(null);
  useEffect(() => {
    if (failedPayload && announcedPayloadRef.current !== failedPayload) {
      playSound("error");
    }
    announcedPayloadRef.current = failedPayload;
  }, [failedPayload]);
  const isAutoRetry =
    classified !== null &&
    classified.isRetryable &&
    classified.status === 429 &&
    autoRetrySeconds > 0;

  const [countdown, setCountdown] = useState(autoRetrySeconds);
  useEffect(() => {
    setCountdown(autoRetrySeconds);
  }, [autoRetrySeconds, isOpen, failedPayload]);

  useEffect(() => {
    if (!isAutoRetry) return;
    const countdownTimer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    const retryTimer = setTimeout(
      () => {
        void retryGeneration();
      },
      Math.max(1, autoRetrySeconds) * 1000,
    );
    return () => {
      clearInterval(countdownTimer);
      clearTimeout(retryTimer);
    };
  }, [isAutoRetry, autoRetrySeconds, retryGeneration, failedPayload]);

  // Hooks must run unconditionally (the dialog may render null below).
  const [isExpanded, setIsExpanded] = useState(false);
  // Collapse the details view whenever a new error appears.
  useEffect(() => {
    setIsExpanded(false);
  }, [failedPayload]);

  if (!isOpen || !classified) return null;

  const messageText = classified.messageIsKey
    ? t(classified.message, { defaultValue: classified.message })
    : classified.message;
  const messageLines = messageText.split("\n");
  const needsClamp = messageLines.length > MAX_VISIBLE_LINES;
  const visibleMessage = isExpanded
    ? messageText
    : messageLines.slice(0, MAX_VISIBLE_LINES).join("\n") + (needsClamp ? " ..." : "");

  const isStartFailure = failedGeneration?.payload.kind === "start";

  const handleRetry = () => {
    void retryGeneration();
  };

  const handleStartOver = async () => {
    dismissError();
    await goToTitle();
    navigate(ROUTES.HOME, { viewTransition: true });
  };

  const handleDismiss = () => {
    dismissError();
    if (isStartFailure) {
      navigate(ROUTES.SETUP, { replace: true, viewTransition: true });
    }
  };

  const borderColor = classified.onlyInformation
    ? "border-text-border"
    : classified.isRetryable
      ? "border-amber-400"
      : "border-danger";

  return (
    <div className="animate-fade-in fixed inset-0 z-110 flex items-center justify-center bg-black/20 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-text-bg/95 text-body-text max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border-3 p-8 shadow-2xl ${borderColor}`}
      >
        <h2 className="font-serif-display mb-4 text-xl font-bold">
          {classified.isRetryable ? t("errorStumbleTitle") : t("errorOccurredTitle")}
        </h2>
        <p className="support-text-color text-sm leading-relaxed whitespace-pre-wrap">
          {visibleMessage}
        </p>
        {needsClamp && (
          <button
            type="button"
            className="text-primary mt-2 cursor-pointer text-xs underline"
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {isExpanded ? t("errorShowLess") : t("errorShowMore")}
          </button>
        )}
        {isAutoRetry && (
          <p className="explanation-text-style animate-pulse mt-4">
            {t("errorAutoRetry", { seconds: countdown })}
          </p>
        )}
        <div className="mt-6 flex flex-row justify-end gap-2">
          {classified.onlyInformation ? (
            <Button intent="tertiary" size="small" onClick={handleDismiss}>
              {t("dismissButton")}
            </Button>
          ) : (
            <>
              {classified.isRetryable && (
                <Button intent="primary" size="small" onClick={handleRetry}>
                  {t("retryButton")}
                </Button>
              )}
              <Button
                intent="tertiary"
                size="small"
                onClick={() => void handleStartOver()}
                disabled={isStartFailure}
              >
                {t("startOverButton")}
              </Button>
              <Button intent="tertiary" size="small" onClick={handleDismiss}>
                {t("dismissButton")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorDialog;

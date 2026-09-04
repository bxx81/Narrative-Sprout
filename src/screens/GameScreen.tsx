import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useConfirm } from "../hooks/useConfirm";
import { useGameStore } from "../store/gameStore";
import { streamStore } from "../store/streamStore";
import { ROUTES } from "../app/routes";
import MainText from "../components/ui/MainText";
import GameNavButtons from "../components/game/GameNavButtons";
import ImageDisplay from "../components/game/ImageDisplay";
import LoadingOverlay, { type SpinnerState } from "../components/game/LoadingOverlay";
import ZoomOverlay from "../components/game/ZoomOverlay";
import HelpTooltip from "../components/ui/HelpTooltip";
import { Icon } from "../components/ui/Icon";
import GameChoices, { LongPressMs } from "../components/game/GameChoices";
import ModelNameDisplay from "../components/game/ModelNameDisplay";
import RefineDialog from "../components/game/RefineDialog";
import { Divider } from "../components/ui/Divider";
import Button from "../components/ui/Button";
import { countWords } from "../features/narrative/api";

const ordinal = (n: number): string => {
  const suffixes = ["th", "st", "nd", "rd"];
  const value = n % 100;
  return n + (suffixes[(value - 20) % 10] ?? suffixes[value] ?? suffixes[0]!);
};

/**
 * The main game screen: scene image, text, choices, and navigation controls.
 * PC shows a sticky two-pane layout; mobile stacks vertically (legacy look).
 * During streaming the partial narration renders live with the overlay
 * suppressed; while autoplay is active the player AI drives the choices.
 */
const GameScreen: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const activeGame = useGameStore((s) => s.activeGame);
  const nodes = useGameStore((s) => s.nodes);
  const assets = useGameStore((s) => s.assets);
  const viewingNodeId = useGameStore((s) => s.viewingNodeId);
  const generation = useGameStore((s) => s.generation);
  const imageRegeneration = useGameStore((s) => s.imageRegeneration);
  const imageGenerationProgress = useGameStore((s) => s.imageGenerationProgress);
  const settings = useGameStore((s) => s.settings);
  const autoplay = useGameStore((s) => s.autoplay);
  const autoplayTurn = useGameStore((s) => s.autoplayTurn);
  const autoplayEndingComment = useGameStore((s) => s.autoplayEndingComment);
  const choose = useGameStore((s) => s.choose);
  const refine = useGameStore((s) => s.refine);
  const goToTitle = useGameStore((s) => s.goToTitle);
  const updateSceneText = useGameStore((s) => s.updateSceneText);
  const runAutoplayTurn = useGameStore((s) => s.runAutoplayTurn);
  const dismissAutoplayEndingComment = useGameStore((s) => s.dismissAutoplayEndingComment);
  const cancelGeneration = useGameStore((s) => s.cancelGeneration);

  const stream = useSyncExternalStore(streamStore.subscribe, streamStore.getSnapshot);
  const confirm = useConfirm();

  const { width, isLandscape } = useBreakpoint();
  const isMd = width >= 768;

  const [choicePresetSignal, setChoicePresetSignal] = useState<{ choice: string } | undefined>(
    undefined,
  );
  const choicePresetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [isEditingScene, setIsEditingScene] = useState(false);
  const sceneEditRef = useRef<HTMLTextAreaElement>(null);

  const loading = generation.phase === "running";
  const isImageRegenerating = imageRegeneration.phase === "running";
  const isAutoplayDeciding = autoplayTurn.phase === "running";
  const isPageLoading = loading || isImageRegenerating || isAutoplayDeciding;
  // Stage of the running narrative generation (legacy state.spinnerState):
  // follows the pipeline text → image so the overlay can show progress.
  const generationStage = useGameStore((s) => s.generationStage);
  // Start time of whichever generation operation is running, for the optional
  // elapsed-seconds display (legacy state.generationStartedAt).
  const generationStartedAt: number | null = loading
    ? new Date(generation.startedAt).getTime()
    : isImageRegenerating
      ? new Date(imageRegeneration.startedAt).getTime()
      : isAutoplayDeciding
        ? new Date(autoplayTurn.startedAt).getTime()
        : null;
  const spinnerState: SpinnerState = isImageRegenerating
    ? "Image"
    : isAutoplayDeciding
      ? "Autoplay"
      : loading
        ? generationStage === "image"
          ? "Image"
          : generationStage === "scene"
            ? "Scene"
            : generation.payload.kind === "choice" || generation.payload.kind === "redo"
              ? "Choice"
              : "Scene"
        : null;

  // Streaming display state (out-of-band store; see streamStore)
  const isStreamingLive = loading && stream.status === "streaming" && stream.sceneText.length > 0;

  const node = useMemo(
    () => nodes.find((n) => n.id === viewingNodeId) ?? null,
    [nodes, viewingNodeId],
  );
  const asset = viewingNodeId ? (assets[viewingNodeId] ?? null) : null;

  // Autoplay driver loop: whenever autoplay is on and the pipeline is idle,
  // ask the player AI for the next action (legacy GameScreen autoplay effect).
  useEffect(() => {
    if (!autoplay) return;
    if (loading || isImageRegenerating) return;
    if (generation.phase === "failed") return;
    if (autoplayTurn.phase === "failed") return;
    if (autoplayTurn.phase === "running") return;
    void runAutoplayTurn();
  }, [
    autoplay,
    loading,
    isImageRegenerating,
    generation.phase,
    autoplayTurn.phase,
    runAutoplayTurn,
  ]);

  // Ending comment dialog (legacy: confirm with reasoning when the story is over)
  useEffect(() => {
    if (!autoplayEndingComment) return;
    void confirm({
      title: t("autoplayCommentTitle", { defaultValue: "Comment" }),
      message: autoplayEndingComment,
      onlyInfo: true,
      cancelLabel: t("dismissButton", { defaultValue: "Dismiss" }),
    }).then(() => dismissAutoplayEndingComment());
  }, [autoplayEndingComment, confirm, dismissAutoplayEndingComment, t]);

  useEffect(() => {
    // Scroll to top when the viewed scene changes (not during image-only regen)
    if (!isImageRegenerating) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [viewingNodeId, loading, isImageRegenerating]);

  const handleChoiceSubmit = (choice: string) => {
    if (loading || autoplay) return;
    void choose(choice);
  };

  const handleRestart = async () => {
    await goToTitle();
    navigate(ROUTES.HOME, { viewTransition: true });
  };

  const handleRefineSubmit = (refinePrompt: string) => {
    if (!viewingNodeId || loading || autoplay) return;
    setRefineOpen(false);
    void refine(viewingNodeId, refinePrompt);
  };

  const handleCancelGeneration = () => {
    cancelGeneration();
  };

  const handleOpenEdit = () => {
    setIsEditingScene(true);
  };

  const handleCancelEdit = () => {
    setIsEditingScene(false);
  };

  const handleApplyEdit = () => {
    if (!viewingNodeId || !sceneEditRef.current) return;
    setIsEditingScene(false);
    void updateSceneText(viewingNodeId, sceneEditRef.current.value);
  };

  const openZoom = () => {
    setIsClosing(false);
    setIsZoomed(true);
  };

  const closeZoom = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsZoomed(false);
      setIsClosing(false);
    }, 300);
  };

  if (!activeGame || !viewingNodeId || !node || !settings) {
    return (
      <div className="bg-body-bg flex h-screen items-center justify-center">
        <p className="support-text-color">{t("sceneNotFound")}</p>
      </div>
    );
  }

  const { scene, turnNumber, choiceText } = node;
  const isCurrentStoryOver = scene.isStoryOver;

  // During streaming the final data does not exist yet: show the submitted
  // choice and a faked turn number to avoid mismatching the previous scene.
  const streamingChoice =
    isStreamingLive && generation.payload.kind === "choice"
      ? (generation.payload.choiceText ?? null)
      : null;
  const displayChoiceText = streamingChoice ?? choiceText;
  const displayTurnNumber = (() => {
    if (!loading || stream.status === "idle") return turnNumber;
    switch (generation.payload.kind) {
      case "choice":
        return turnNumber + 1;
      case "refine":
        return turnNumber;
      default:
        return 1;
    }
  })();

  const cost = node.metadata.generationCost;
  const currentCost = cost && cost > 0 ? "¢" + (cost * 100).toFixed(2) : null;
  const modelName = node.metadata.modelName;
  // Recomputed from sceneText rather than the stored sceneWordCount, so
  // records saved with the old (paragraph-counting) counter display correctly.
  const sceneWordCount = countWords(scene.sceneText);

  const currentDividerText = isStreamingLive
    ? displayTurnNumberText(displayTurnNumber, stream.wordCount, t)
    : [
        turnNumber && (currentCost || sceneWordCount) ? t("dividerThisPrefix", { lng: "en" }) : "",
        turnNumber ? t("dividerTurn", { ordinal: ordinal(turnNumber), lng: "en" }) : "",
        currentCost ? t("dividerCost", { cost: currentCost, lng: "en" }) : "",
        currentCost && sceneWordCount ? t("dividerAnd", { lng: "en" }) : "",
        sceneWordCount ? t("dividerWordsLong", { words: sceneWordCount, lng: "en" }) : "",
      ]
        .join(" ")
        .trim();

  const mainText = (
    <article className="animate-fade-in w-full max-w-2xl md:min-w-[20rem]">
      {isLandscape && (
        <div className="dividers-style text-[9pt]" aria-hidden="true">
          - Narrative Sprout -
        </div>
      )}
      {displayChoiceText ? (
        <p
          className="font-serif-display text-center text-sm leading-relaxed select-text [line-break:strict] selection:bg-lime-500/30"
          onMouseDown={() => {
            choicePresetTimer.current = setTimeout(() => {
              setChoicePresetSignal({ choice: displayChoiceText });
            }, LongPressMs);
          }}
          onMouseUp={() => {
            if (choicePresetTimer.current) {
              clearTimeout(choicePresetTimer.current);
              choicePresetTimer.current = null;
            }
          }}
          onMouseLeave={() => {
            if (choicePresetTimer.current) {
              clearTimeout(choicePresetTimer.current);
              choicePresetTimer.current = null;
            }
          }}
          onTouchStart={() => {
            choicePresetTimer.current = setTimeout(() => {
              setChoicePresetSignal({ choice: displayChoiceText });
            }, 500);
          }}
          onTouchEnd={() => {
            if (choicePresetTimer.current) {
              clearTimeout(choicePresetTimer.current);
              choicePresetTimer.current = null;
            }
          }}
          onTouchMove={() => {
            if (choicePresetTimer.current) {
              clearTimeout(choicePresetTimer.current);
              choicePresetTimer.current = null;
            }
          }}
        >
          {displayChoiceText}
        </p>
      ) : (
        <Divider />
      )}

      <div className="dividers-style md:pb-12" data-testid="divide">
        {currentDividerText}
      </div>

      <div className="font-serif-display select-text selection:bg-lime-500/30">
        {isEditingScene && !loading ? (
          <div>
            <HelpTooltip content={t("helpEditSceneText")} />
            <textarea
              ref={sceneEditRef}
              defaultValue={scene.sceneText}
              rows={10}
              className="border-text-border m-0 mt-2 w-full resize-y border-2 text-sm"
              disabled={loading}
            ></textarea>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                intent="circle"
                onClick={handleCancelEdit}
                title={t("cancelButton")}
                aria-label={t("cancelButton")}
              >
                <Icon iconName="close" />
              </Button>
              <Button
                intent="circle"
                onClick={handleApplyEdit}
                title={t("applyEditButtonLabel")}
                aria-label={t("applyEditButtonLabel")}
              >
                <Icon iconName="check" />
              </Button>
            </div>
          </div>
        ) : (
          <MainText
            text={isStreamingLive ? stream.sceneText : scene.sceneText}
            streamingCursor={isStreamingLive && !stream.sceneTextComplete}
          />
        )}
        {isCurrentStoryOver && !isStreamingLive && !isEditingScene && scene.storyClosingText && (
          <>
            <Divider className="my-8" />
            <MainText text={scene.storyClosingText} className="font-semibold" />
          </>
        )}
      </div>
      <Divider className="my-8 md:my-16" />

      {loading && stream.status !== "idle" ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="choice-style animate-pulse select-none">
              &nbsp;
            </div>
          ))}
        </div>
      ) : (
        <GameChoices
          choices={scene.choices}
          isCurrentStoryOver={isCurrentStoryOver}
          loading={isPageLoading || autoplay}
          onChoiceSubmit={handleChoiceSubmit}
          onRestart={() => void handleRestart()}
          viewingNodeId={viewingNodeId}
          choicePreset={choicePresetSignal}
        />
      )}

      {modelName ? (
        <div className="dividers-style my-16">
          {t("generatedBy", { lng: "en" })}{" "}
          <ModelNameDisplay key={viewingNodeId} modelName={modelName} />
        </div>
      ) : (
        <Divider className="my-16" />
      )}
    </article>
  );

  const sceneImageProps = {
    imageBlob: asset?.blob ?? null,
    alt: scene.imagePrompt,
  };

  return (
    <div className="bg-body-bg min-h-screen transition-colors duration-500">
      <LoadingOverlay
        isPageLoading={isPageLoading}
        spinnerState={spinnerState}
        imageGenerationProgress={imageGenerationProgress}
        imageGenerator={settings.imageGenerator}
        error={generation.phase === "failed" || imageRegeneration.phase === "failed"}
        // ライブ本文表示の間はオーバーレイを隠す（ストリーミング中）。
        // ただし本文の受信が完了したら残り JSON（choices/notes 等）の生成中に
        // スピナーを復帰させる。画像生成段階でも復帰（Legacy 同様）。
        suppressed={
          loading &&
          stream.status === "streaming" &&
          stream.sceneText.length > 0 &&
          !stream.sceneTextComplete &&
          generationStage !== "image"
        }
        showElapsedTime={settings.showElapsedTime}
        generationStartedAt={generationStartedAt}
      />

      {(loading || isAutoplayDeciding) && stream.status !== "idle" && (
        <Button
          intent="navigator"
          size="medium-circle"
          className="fixed right-21 bottom-6 z-120"
          onClick={handleCancelGeneration}
          title={t("cancelGenerationButton")}
          aria-label={t("cancelGenerationButton")}
        >
          <Icon iconName="stop_circle" />
        </Button>
      )}

      <RefineDialog
        isOpen={refineOpen}
        onClose={() => setRefineOpen(false)}
        onSubmit={handleRefineSubmit}
        isBusy={loading}
      />

      {isZoomed && (
        <ZoomOverlay
          isClosing={isClosing}
          onClose={closeZoom}
          imageBlob={asset?.blob ?? null}
          alt={scene.imagePrompt}
        />
      )}

      {!isMd && (
        <div className="flex flex-col">
          <button
            className="bg-body-bg relative w-full cursor-zoom-in overflow-hidden"
            onClick={openZoom}
            aria-label={t("enlargeImageLabel")}
          >
            <ImageDisplay
              {...sceneImageProps}
              className="mx-auto block h-auto max-h-[80vh] w-full object-contain transition-transform duration-500 hover:scale-[1.02]"
            />
          </button>

          <nav className="text-bg-color border-text-border sticky top-0 z-50 flex items-center justify-center gap-3 border-y p-3">
            <GameNavButtons onOpenRefine={() => setRefineOpen(true)} onOpenEdit={handleOpenEdit} />
          </nav>

          <main className="bg-text-bg flex flex-col items-center p-6 pb-12">{mainText}</main>
        </div>
      )}

      {isMd && (
        <div className="flex">
          <aside className="border-text-border bg-body-bg sticky top-0 flex h-screen w-[45%] min-w-100 items-center justify-center overflow-hidden border-r p-8 backdrop-blur-md">
            <div className="animate-fade-in flex max-h-full max-w-full flex-col items-center gap-8">
              <button
                className="group relative cursor-zoom-in overflow-hidden rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-700 hover:scale-[1.01] hover:shadow-[0_30px_60px_rgba(0,0,0,0.4)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
                onClick={openZoom}
                aria-label={t("enlargeImageLabel")}
              >
                <ImageDisplay
                  {...sceneImageProps}
                  className="block max-h-[70vh] w-auto object-contain"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </button>

              <nav className="body-bg-color border-text-border/20 z-3 flex items-center gap-3 rounded-2xl border p-3 px-5 shadow-lg">
                <GameNavButtons
                  onOpenRefine={() => setRefineOpen(true)}
                  onOpenEdit={handleOpenEdit}
                />
              </nav>
            </div>
          </aside>

          <main className="bg-text-bg flex flex-1 flex-col items-center p-20 md:p-24 md:pt-16">
            {mainText}
          </main>
        </div>
      )}
    </div>
  );
};

function displayTurnNumberText(
  displayTurnNumber: number,
  wordCount: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (!displayTurnNumber) {
    return wordCount > 0 ? t("dividerWordsSoFarOnly", { words: wordCount, lng: "en" }) : "";
  }
  if (wordCount <= 0) {
    return t("dividerTurn", { ordinal: ordinal(displayTurnNumber), lng: "en" });
  }
  return t("dividerWordsSoFar", {
    ordinal: ordinal(displayTurnNumber),
    words: wordCount,
    lng: "en",
  });
}

export default GameScreen;

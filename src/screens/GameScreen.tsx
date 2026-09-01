import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useGameStore } from "../store/gameStore";
import { ROUTES } from "../app/routes";
import MainText from "../components/ui/MainText";
import GameNavButtons from "../components/game/GameNavButtons";
import ImageDisplay from "../components/game/ImageDisplay";
import LoadingOverlay, { type SpinnerState } from "../components/game/LoadingOverlay";
import ZoomOverlay from "../components/game/ZoomOverlay";
import GameChoices, { LongPressMs } from "../components/game/GameChoices";
import ModelNameDisplay from "../components/game/ModelNameDisplay";
import RefineDialog from "../components/game/RefineDialog";
import { Divider } from "../components/ui/Divider";
import { countWords } from "../features/narrative/api";

const ordinal = (n: number): string => {
  const suffixes = ["th", "st", "nd", "rd"];
  const value = n % 100;
  return n + (suffixes[(value - 20) % 10] ?? suffixes[value] ?? suffixes[0]!);
};

/**
 * The main game screen: scene image, text, choices, and navigation controls.
 * PC shows a sticky two-pane layout; mobile stacks vertically (legacy look).
 */
const GameScreen: React.FC = () => {
  const navigate = useNavigate();
  const activeGame = useGameStore((s) => s.activeGame);
  const nodes = useGameStore((s) => s.nodes);
  const assets = useGameStore((s) => s.assets);
  const viewingNodeId = useGameStore((s) => s.viewingNodeId);
  const generation = useGameStore((s) => s.generation);
  const imageRegeneration = useGameStore((s) => s.imageRegeneration);
  const imageGenerationProgress = useGameStore((s) => s.imageGenerationProgress);
  const settings = useGameStore((s) => s.settings);
  const choose = useGameStore((s) => s.choose);
  const refine = useGameStore((s) => s.refine);
  const goToTitle = useGameStore((s) => s.goToTitle);

  const { width, isLandscape } = useBreakpoint();
  const isMd = width >= 768;

  const [choicePresetSignal, setChoicePresetSignal] = useState<{ choice: string } | undefined>(
    undefined,
  );
  const choicePresetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);

  const loading = generation.phase === "running";
  const isImageRegenerating = imageRegeneration.phase === "running";
  const isPageLoading = loading || isImageRegenerating;
  const spinnerState: SpinnerState = isImageRegenerating
    ? "Image"
    : generation.phase === "running"
      ? generation.payload.kind === "choice"
        ? "Choice"
        : "Scene"
      : null;

  const node = useMemo(
    () => nodes.find((n) => n.id === viewingNodeId) ?? null,
    [nodes, viewingNodeId],
  );
  const asset = viewingNodeId ? (assets[viewingNodeId] ?? null) : null;

  useEffect(() => {
    // Scroll to top when the viewed scene changes (not during image-only regen)
    if (!isImageRegenerating) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [viewingNodeId, loading, isImageRegenerating]);

  const handleChoiceSubmit = (choice: string) => {
    if (loading) return;
    void choose(choice);
  };

  const handleRestart = async () => {
    await goToTitle();
    navigate(ROUTES.HOME, { viewTransition: true });
  };

  const handleRefineSubmit = (refinePrompt: string) => {
    if (!viewingNodeId || loading) return;
    setRefineOpen(false);
    void refine(viewingNodeId, refinePrompt);
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
        <p className="support-text-color">Scene not found.</p>
      </div>
    );
  }

  const { scene, turnNumber, choiceText } = node;

  const isCurrentStoryOver = scene.isStoryOver;

  const cost = node.metadata.generationCost;
  const currentCost = cost && cost > 0 ? "¢" + (cost * 100).toFixed(2) : null;
  const modelName = node.metadata.modelName;
  // Recomputed from sceneText rather than the stored sceneWordCount, so
  // records saved with the old (paragraph-counting) counter display correctly.
  const sceneWordCount = countWords(scene.sceneText);

  const currentDividerText = [
    turnNumber && (currentCost || sceneWordCount) ? "This" : "",
    turnNumber ? `${ordinal(turnNumber)} turn` : "",
    currentCost ? `cost ${currentCost}` : "",
    currentCost && sceneWordCount ? "and" : "",
    sceneWordCount ? `is ${sceneWordCount} words long.` : "",
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
      {choiceText ? (
        <p
          className="font-serif-display text-center text-sm leading-relaxed select-text [line-break:strict] selection:bg-lime-500/30"
          onMouseDown={() => {
            choicePresetTimer.current = setTimeout(() => {
              setChoicePresetSignal({ choice: choiceText });
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
              setChoicePresetSignal({ choice: choiceText });
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
          {choiceText}
        </p>
      ) : (
        <Divider />
      )}

      <div className="dividers-style md:pb-12" data-testid="divide">
        {currentDividerText}
      </div>

      <div className="font-serif-display select-text selection:bg-lime-500/30">
        <MainText text={scene.sceneText} />
        {isCurrentStoryOver && scene.storyClosingText && (
          <>
            <Divider className="my-8" />
            <MainText text={scene.storyClosingText} className="font-semibold" />
          </>
        )}
      </div>
      <Divider className="my-8 md:my-16" />

      <GameChoices
        choices={scene.choices}
        isCurrentStoryOver={isCurrentStoryOver}
        loading={loading}
        onChoiceSubmit={handleChoiceSubmit}
        onRestart={() => void handleRestart()}
        viewingNodeId={viewingNodeId}
        choicePreset={choicePresetSignal}
      />

      {generation.phase === "failed" && (
        <p className="mt-4 text-center text-sm font-semibold text-danger">
          Generation failed: {generation.error.message}
        </p>
      )}

      {imageRegeneration.phase === "failed" && (
        <p className="mt-4 text-center text-sm font-semibold text-danger">
          Image regeneration failed: {imageRegeneration.error.message}
        </p>
      )}

      {modelName ? (
        <div className="dividers-style my-16">
          Generated by <ModelNameDisplay key={viewingNodeId} modelName={modelName} />
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
      />

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
            aria-label="Enlarge image"
          >
            <ImageDisplay
              {...sceneImageProps}
              className="mx-auto block h-auto max-h-[80vh] w-full object-contain transition-transform duration-500 hover:scale-[1.02]"
            />
          </button>

          <nav className="text-bg-color border-text-border sticky top-0 z-50 flex items-center justify-center gap-3 border-y p-3">
            <GameNavButtons onOpenRefine={() => setRefineOpen(true)} />
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
                aria-label="Enlarge image"
              >
                <ImageDisplay
                  {...sceneImageProps}
                  className="block max-h-[70vh] w-auto object-contain"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </button>

              <nav className="body-bg-color border-text-border/20 z-3 flex items-center gap-3 rounded-2xl border p-3 px-5 shadow-lg">
                <GameNavButtons onOpenRefine={() => setRefineOpen(true)} />
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

export default GameScreen;

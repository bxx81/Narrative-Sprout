import React, { memo, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useGameStore } from "../store/gameStore";
import type { GameRecord, StoryNodeRecord } from "../types";
import { useLazyNodeImage } from "../hooks/useLazyNodeImage";
import { useLatestNodes } from "../hooks/useLatestNodes";
import { useIncrementalList } from "../hooks/useIncrementalList";
import StoryCard from "../components/StoryCard";
import BackButton from "../components/ui/BackButton";
import { ROUTES } from "../app/routes";
import Button from "../components/ui/Button";
import { LOAD_SCREEN_FALLBACK_URL } from "../components/game/imageFallbacks";
import { useConfirm } from "../hooks/useConfirm";
import { DIALOG_EMBEDDED_TITLE_MAX_LENGTH, truncateText } from "../lib/truncateText";

const CARD_PAGE_SIZE = 24;

// Module scope: one formatter for all cards instead of one per card render.
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * A card component for displaying a saved game.
 *
 * The latest-node preview is passed in from a page-level `bulkGet`
 * (`useLatestNodes`) instead of fetching per card, so mounting N cards
 * costs one IndexedDB round-trip per visible page, not N.
 */
const GameLogCard: React.FC<{ game: GameRecord; latestNode: StoryNodeRecord | null }> = memo(
  ({ game, latestNode }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const confirm = useConfirm();
    const openGame = useGameStore((s) => s.openGame);
    const deleteSave = useGameStore((s) => s.deleteSave);

    const {
      elementRef,
      imageUrl,
      isLoading: isLoadingImage,
    } = useLazyNodeImage(game.latestNodeId, {
      fallbackUrl: LOAD_SCREEN_FALLBACK_URL,
    });

    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      if (e.currentTarget.src !== LOAD_SCREEN_FALLBACK_URL) {
        e.currentTarget.src = LOAD_SCREEN_FALLBACK_URL;
      }
    };

    const handleLoadGame = async () => {
      await openGame(game.id);
      navigate(ROUTES.HISTORY, { viewTransition: true });
    };

    const handleDelete = async () => {
      // game.title holds the full theme text (up to tens of KB). Embedding it
      // raw would blow up the dialog, so shorten it for the message.
      const shortTitle = truncateText(game.title, DIALOG_EMBEDDED_TITLE_MAX_LENGTH);
      const result = await confirm({
        title: t("deleteConfirmTitle"),
        message: t("deleteSaveConfirmMessage", {
          title: shortTitle,
          defaultValue: `Delete "${shortTitle}" and all of its scenes and images? This cannot be undone.`,
        }),
        confirmLabel: t("deleteButton"),
        cancelLabel: t("cancelButton"),
        isDestructive: true,
        icon: "delete_forever",
      });
      if (result !== true) return;
      await deleteSave(game.id);
    };

    const formattedDate = useMemo(
      () => dateFormatter.format(new Date(game.lastPlayedAt)),
      [game.lastPlayedAt],
    );

    const scenePreviewText = useMemo(
      () =>
        latestNode
          ? latestNode.scene.sceneText +
            (latestNode.scene.isStoryOver ? " - " : "") +
            latestNode.scene.storyClosingText
          : "",
      [latestNode],
    );

    const timeContent = useMemo(
      () => (
        <p className="support-text-color text-xs">
          {t("loadScreenTimestampLabel")} <time dateTime={game.lastPlayedAt}>{formattedDate}</time>
        </p>
      ),
      [t, game.lastPlayedAt, formattedDate],
    );

    const cardActions = useMemo(
      () => (
        <div className="flex">
          <Button
            onClick={() => void handleLoadGame()}
            intent="secondary"
            size="small"
            className="w-full"
          >
            {t("loadButton")}
          </Button>
        </div>
      ),
      [t, game.id],
    );

    return (
      <article ref={elementRef} className="h-full">
        <StoryCard
          imageUrl={imageUrl}
          imageAlt={game.title}
          isLoadingImage={isLoadingImage}
          onImageError={handleImageError}
          actions={cardActions}
          onImageClick={() => void handleLoadGame()}
          onMenuClick={() => void handleDelete()}
          menuText={t("deleteButton")}
          mainText={game.title}
          subText={scenePreviewText}
          timeText={timeContent}
        />
      </article>
    );
  },
);
GameLogCard.displayName = "GameLogCard";

/**
 * The screen for loading a saved game. Also accepts ns-save ZIP imports
 * via drag & drop.
 *
 * Only the visible window (`CARD_PAGE_SIZE` at a time) is mounted: text
 * previews resolve via one bulk `bulkGet` per page and images stay
 * IntersectionObserver-lazy, so hundreds of slots no longer mount N cards,
 * N node reads, and N image observers up front.
 */
const LoadScreen: React.FC = () => {
  const { t } = useTranslation();
  const games = useGameStore((s) => s.games);
  const importSaveFromFile = useGameStore((s) => s.importSaveFromFile);
  // ISO-8601 timestamps sort lexicographically; avoids N log N Date parsing.
  const sortedGames = useMemo(
    () => [...games].sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt)),
    [games],
  );
  const { visibleCount, sentinelRef, canShowMore, showMore } = useIncrementalList(
    sortedGames.length,
    CARD_PAGE_SIZE,
  );
  const visibleGames = useMemo(
    () => sortedGames.slice(0, visibleCount),
    [sortedGames, visibleCount],
  );
  const latestNodeMap = useLatestNodes(visibleGames.map((game) => game.latestNodeId));
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFiles(e.target.files);
    e.target.value = "";
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      for (const file of Array.from(files)) {
        const result = await importSaveFromFile(file);
        if (!result.restoredGameCount && !result.restoredNodeCount) {
          toast.error(t("noImportableSaveData"));
        } else {
          toast.success(t("toastLoadSavedataSuccess"));
        }
      }
    } catch (error) {
      console.error("[import] save import failed", error);
      toast.error(error instanceof Error ? error.message : t("importFailed"));
    }
  };

  return (
    <main
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex w-full flex-col items-center"
    >
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-lime-500/20 backdrop-blur-sm">
          <div className="rounded-lg border-4 border-dashed border-white bg-black/50 p-12 text-center text-white">
            <p className="text-2xl font-bold">{t("dropFilesHere")}</p>
          </div>
        </div>
      )}
      <div className="mx-auto mb-20 max-w-384">
        <header className="text-center">
          <h1 className="font-serif-display text-3xl font-bold md:text-4xl">
            {t("loadScreenTitle")}
          </h1>
        </header>
        <div className="mb-8 flex justify-center pb-4">
          <input
            ref={fileInputRef}
            type="file"
            className="peer sr-only"
            accept=".zip"
            onChange={handleFileChange}
            multiple
            hidden
          />
          <Button
            intent="tertiary"
            size="small"
            onClick={() => {
              fileInputRef.current?.click();
            }}
          >
            {t("loadSavedataButton")}
          </Button>
        </div>

        {sortedGames.length > 0 ? (
          <>
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {visibleGames.map((game) => (
                <li key={game.id}>
                  <GameLogCard
                    game={game}
                    latestNode={
                      game.latestNodeId ? (latestNodeMap.get(game.latestNodeId) ?? null) : null
                    }
                  />
                </li>
              ))}
            </ul>
            {canShowMore && (
              <>
                <div ref={sentinelRef} aria-hidden="true" className="h-1" />
                <div className="mt-8 flex justify-center">
                  <Button intent="tertiary" size="small" onClick={showMore}>
                    {t("showMoreButton", { defaultValue: "Show more" })}
                  </Button>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="rounded-lg bg-body-bg px-6 py-20 text-center shadow-md">
            <p className="support-text-color text-xl">{t("loadScreenNoSaves")}</p>
          </div>
        )}
        <BackButton />
      </div>
    </main>
  );
};

export default LoadScreen;

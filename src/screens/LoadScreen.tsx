import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useGameStore } from "../store/gameStore";
import type { GameRecord } from "../types";
import { useLazyNodeImage } from "../hooks/useLazyNodeImage";
import { useNode } from "../hooks/useNode";
import StoryCard from "../components/StoryCard";
import BackButton from "../components/ui/BackButton";
import { ROUTES } from "../app/routes";
import Button from "../components/ui/Button";
import { LOAD_SCREEN_FALLBACK_URL } from "../components/game/imageFallbacks";
import { useConfirm } from "../hooks/useConfirm";

/**
 * A card component for displaying a saved game.
 */
const GameLogCard: React.FC<{ game: GameRecord }> = ({ game }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const confirm = useConfirm();
  const openGame = useGameStore((s) => s.openGame);
  const deleteSave = useGameStore((s) => s.deleteSave);

  const latestNode = useNode(game.latestNodeId);

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
    const result = await confirm({
      title: t("deleteConfirmTitle"),
      message: t("deleteSaveConfirmMessage", {
        title: game.title,
        defaultValue: `Delete "${game.title}" and all of its scenes and images? This cannot be undone.`,
      }),
      confirmLabel: t("deleteButton"),
      cancelLabel: t("cancelButton"),
      isDestructive: true,
      icon: "delete_forever",
    });
    if (result !== true) return;
    await deleteSave(game.id);
  };

  const formattedDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(game.lastPlayedAt));

  const scenePreviewText = latestNode
    ? latestNode.scene.sceneText +
      (latestNode.scene.isStoryOver ? " - " : "") +
      latestNode.scene.storyClosingText
    : "";

  const timeContent = (
    <p className="support-text-color text-xs">
      {t("loadScreenTimestampLabel")} <time dateTime={game.lastPlayedAt}>{formattedDate}</time>
    </p>
  );

  const cardActions = (
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
};

/**
 * The screen for loading a saved game. Also accepts ns-save ZIP imports
 * via drag & drop.
 */
const LoadScreen: React.FC = () => {
  const { t } = useTranslation();
  const games = useGameStore((s) => s.games);
  const importSaveFromFile = useGameStore((s) => s.importSaveFromFile);
  const sortedGames = useMemo(
    () =>
      [...games].sort(
        (a, b) => new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime(),
      ),
    [games],
  );
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
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {sortedGames.map((game) => (
              <li key={game.id}>
                <GameLogCard game={game} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="bg-body-bg rounded-lg px-6 py-20 text-center shadow-md">
            <p className="support-text-color text-xl">{t("loadScreenNoSaves")}</p>
          </div>
        )}
        <BackButton />
      </div>
    </main>
  );
};

export default LoadScreen;

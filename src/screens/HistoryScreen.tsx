import React, { memo, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";
import { useGameStore } from "../store/gameStore";
import type { StoryNodeRecord } from "../types";
import type { AssetRecord } from "../types/asset";
import { useLazyNodeImage } from "../hooks/useLazyNodeImage";
import { useIncrementalList } from "../hooks/useIncrementalList";
import StoryCard from "../components/StoryCard";
import BackButton from "../components/ui/BackButton";
import { ROUTES } from "../app/routes";
import Button from "../components/ui/Button";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { LOAD_SCREEN_FALLBACK_URL } from "../components/game/imageFallbacks";
import { useConfirm } from "../hooks/useConfirm";
import { CARD_TITLE_MAX_LENGTH, truncateText } from "../lib/truncateText";

const CARD_PAGE_SIZE = 24;

/**
 * A card component for displaying an end (leaf) node.
 *
 * `getAsset` reuses the store's already-loaded assets so visible cards don't
 * re-read IndexedDB per card on top of `openGame`'s bulk load.
 */
const EndNodeCard: React.FC<{
  node: StoryNodeRecord;
  getAsset: (nodeId: string) => Promise<AssetRecord | undefined>;
}> = memo(({ node, getAsset }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const confirm = useConfirm();
  const resumeStoryAtNode = useGameStore((s) => s.resumeStoryAtNode);
  const setChronicleTargetNode = useGameStore((s) => s.setChronicleTargetNode);
  const deleteBranch = useGameStore((s) => s.deleteBranch);

  const {
    elementRef,
    imageUrl,
    isLoading: isLoadingImage,
  } = useLazyNodeImage(node.id, {
    fallbackUrl: LOAD_SCREEN_FALLBACK_URL,
    getAsset,
  });

  // Legacy rewind semantics: the playhead moves to this leaf so that
  // Back/Forward navigation walks its branch from the play screen.
  const handleRewind = () => {
    resumeStoryAtNode(node.id, node.id);
    navigate(ROUTES.PLAY, { viewTransition: true });
  };

  const handleViewChronicle = () => {
    setChronicleTargetNode(node.id);
    navigate(ROUTES.CHRONICLE, { viewTransition: true });
  };

  const handleDelete = async () => {
    const result = await confirm({
      title: t("deleteBranchConfirmTitle"),
      message: t("deleteBranchConfirm"),
      confirmLabel: t("deleteButton"),
      cancelLabel: t("cancelButton"),
      isDestructive: true,
      icon: "delete_forever",
    });
    if (result !== true) return;
    const { gameDeleted } = await deleteBranch(node.id);
    if (gameDeleted) {
      navigate(ROUTES.LOAD, { viewTransition: true });
    }
  };

  const scenePreviewText = useMemo(
    () =>
      node.scene.sceneText + (node.scene.isStoryOver ? " - " : "") + node.scene.storyClosingText,
    [node.scene.sceneText, node.scene.isStoryOver, node.scene.storyClosingText],
  );

  const mainText = useMemo(
    () =>
      node.choiceText
        ? t("historyChoicePrefixText", {
            choice: truncateText(node.choiceText, CARD_TITLE_MAX_LENGTH),
          })
        : t("historyInitialEntry"),
    [node.choiceText, t],
  );

  const cardActions = useMemo(
    () => (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={handleViewChronicle} intent="secondary" size="small" className="flex-1">
          <p className="line-clamp-3">{t("historyViewStoryButton")}</p>
        </Button>
        <Button onClick={handleRewind} intent="primary" size="small" className="flex-1">
          <p className="line-clamp-3">{t("historyContinueButton")}</p>
        </Button>
      </div>
    ),
    [t, node.id],
  );

  return (
    <article ref={elementRef} className="h-full">
      <StoryCard
        imageUrl={imageUrl}
        imageAlt={node.scene.imagePrompt}
        isLoadingImage={isLoadingImage}
        actions={cardActions}
        onImageClick={handleRewind}
        onMenuClick={() => void handleDelete()}
        menuText={t("deleteButton")}
        mainText={mainText}
        subText={scenePreviewText}
      />
    </article>
  );
});
EndNodeCard.displayName = "EndNodeCard";

/**
 * The history screen: every ending / branching point of the active game.
 *
 * Only the visible window (`CARD_PAGE_SIZE` at a time) is mounted so games
 * with hundreds of branches don't mount N cards and N image observers
 * up front; the rest reveal as the sentinel scrolls into view.
 */
const HistoryScreen: React.FC = () => {
  const { t } = useTranslation();
  const activeGame = useGameStore((s) => s.activeGame);
  const nodes = useGameStore((s) => s.nodes);
  const assets = useGameStore((s) => s.assets);
  const exportSave = useGameStore((s) => s.exportSave);
  const [isExporting, setIsExporting] = React.useState(false);

  // Stable loader over the store's bulk-loaded assets (ref avoids effect churn).
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const getAsset = useCallback((nodeId: string) => Promise.resolve(assetsRef.current[nodeId]), []);

  const endNodes = useMemo(() => {
    const parentIds = new Set(nodes.flatMap((n) => (n.parentNodeId ? [n.parentNodeId] : [])));
    return nodes
      .filter((node) => !parentIds.has(node.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [nodes]);

  const { visibleCount, sentinelRef, canShowMore, showMore } = useIncrementalList(
    endNodes.length,
    CARD_PAGE_SIZE,
  );
  const visibleNodes = useMemo(() => endNodes.slice(0, visibleCount), [endNodes, visibleCount]);

  const handleExport = async () => {
    if (!activeGame || isExporting) return;
    setIsExporting(true);
    try {
      await exportSave(activeGame.id);
      toast.success(t("toastDownloadSavedataSuccess"));
    } catch (error) {
      console.error("[export] save export failed", error);
      toast.error(error instanceof Error ? error.message : t("exportFailed"));
    } finally {
      setIsExporting(false);
    }
  };

  if (!activeGame) {
    return (
      <div className="flex h-screen items-center justify-center bg-body-bg">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <main className="mx-auto mb-20 max-w-384">
      <header className="text-center">
        <h1 className="font-serif-display text-3xl font-bold md:text-4xl">
          {t("historyScreenTitle")}
        </h1>
        <p className="support-text-color mx-auto my-2 max-w-3xl text-lg">
          {t("historyScreenDescription")}
        </p>
      </header>
      <div className="mb-12 flex justify-center">
        <Button
          size="small"
          intent="tertiary"
          onClick={() => void handleExport()}
          isWorking={isExporting}
          disabled={isExporting}
        >
          {t("downloadSavedataButton")}
        </Button>
      </div>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {visibleNodes.map((node) => (
          <li key={node.id}>
            <EndNodeCard node={node} getAsset={getAsset} />
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
      <BackButton />
    </main>
  );
};

export default HistoryScreen;

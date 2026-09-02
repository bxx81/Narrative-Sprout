import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";
import { useGameStore } from "../store/gameStore";
import type { StoryNodeRecord } from "../types";
import { useLazyNodeImage } from "../hooks/useLazyNodeImage";
import StoryCard from "../components/StoryCard";
import BackButton from "../components/ui/BackButton";
import { ROUTES } from "../app/routes";
import Button from "../components/ui/Button";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { LOAD_SCREEN_FALLBACK_URL } from "../components/game/imageFallbacks";
import { useConfirm } from "../hooks/useConfirm";

/**
 * A card component for displaying an end (leaf) node.
 */
const EndNodeCard: React.FC<{ node: StoryNodeRecord }> = ({ node }) => {
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

  const scenePreviewText =
    node.scene.sceneText + (node.scene.isStoryOver ? " - " : "") + node.scene.storyClosingText;

  const cardActions = (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button onClick={handleViewChronicle} intent="secondary" size="small" className="flex-1">
        <p className="line-clamp-3">{t("historyViewStoryButton")}</p>
      </Button>
      <Button onClick={handleRewind} intent="primary" size="small" className="flex-1">
        <p className="line-clamp-3">{t("historyContinueButton")}</p>
      </Button>
    </div>
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
        mainText={
          node.choiceText
            ? t("historyChoicePrefixText", { choice: node.choiceText })
            : t("historyInitialEntry")
        }
        subText={scenePreviewText}
      />
    </article>
  );
};

/**
 * The history screen: every ending / branching point of the active game.
 */
const HistoryScreen: React.FC = () => {
  const { t } = useTranslation();
  const activeGame = useGameStore((s) => s.activeGame);
  const nodes = useGameStore((s) => s.nodes);
  const exportSave = useGameStore((s) => s.exportSave);
  const [isExporting, setIsExporting] = React.useState(false);

  const endNodes = useMemo(() => {
    const parentIds = new Set(nodes.flatMap((n) => (n.parentNodeId ? [n.parentNodeId] : [])));
    return nodes
      .filter((node) => !parentIds.has(node.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [nodes]);

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
      <div className="bg-body-bg flex h-screen items-center justify-center">
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
        {endNodes.map((node) => (
          <li key={node.id}>
            <EndNodeCard node={node} />
          </li>
        ))}
      </ul>
      <BackButton />
    </main>
  );
};

export default HistoryScreen;

import React, { useCallback, useEffect, useRef, useState } from "react";
import Button from "../ui/Button";
import { useGameNavigation } from "../../hooks/useGameNavigation";
import { useGameStore } from "../../store/gameStore";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ROUTES } from "../../app/routes";
import { Icon } from "../ui/Icon";
import { useConfirm } from "../../hooks/useConfirm";

const isShortcutBlocked = (element: Element | null) => {
  if (!element) return false;
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  );
};

/**
 * Scene navigation buttons + overflow menu (legacy GameNavButtons ported to
 * the v2 store). Autoplay toggles from the menu; refine and delete branch
 * also live here.
 */
const GameNavButtons: React.FC<{ onOpenRefine: () => void; onOpenEdit: () => void }> = ({
  onOpenRefine,
  onOpenEdit,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const confirm = useConfirm();
  const generation = useGameStore((s) => s.generation);
  const imageRegeneration = useGameStore((s) => s.imageRegeneration);
  const settings = useGameStore((s) => s.settings);
  const activeGame = useGameStore((s) => s.activeGame);
  const viewingNodeId = useGameStore((s) => s.viewingNodeId);
  const autoplay = useGameStore((s) => s.autoplay);
  const regenerateImage = useGameStore((s) => s.regenerateImage);
  const goToTitle = useGameStore((s) => s.goToTitle);
  const deleteBranch = useGameStore((s) => s.deleteBranch);
  const redoScene = useGameStore((s) => s.redoScene);
  const toggleAutoplay = useGameStore((s) => s.toggleAutoplay);

  const { canGoBack, canGoForward, isAtLatest, onNavigateBack, onNavigateForward, onGoToLatest } =
    useGameNavigation();
  const imageGenerator = settings?.imageGenerator ?? "disabled";

  const loading = generation.phase === "running";
  const isImageRegenerating = imageRegeneration.phase === "running";
  const busy = loading || isImageRegenerating;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenuAnd = useCallback((fn: () => void) => {
    fn();
    setMenuOpen(false);
  }, []);

  const handleSwitchToHistory = useCallback(() => {
    navigate(ROUTES.HISTORY, { viewTransition: true });
  }, [navigate]);

  const handleHome = useCallback(async () => {
    await goToTitle();
    navigate(ROUTES.HOME, { viewTransition: true });
  }, [goToTitle, navigate]);

  const handleDeleteBranch = useCallback(async () => {
    if (!viewingNodeId || !activeGame) return;
    const result = await confirm({
      title: t("deleteBranchConfirmTitle"),
      message: t("deleteBranchConfirm"),
      confirmLabel: t("deleteButton"),
      cancelLabel: t("cancelButton"),
      isDestructive: true,
      icon: "delete_forever",
    });
    if (result !== true) return;
    const { gameDeleted } = await deleteBranch(viewingNodeId);
    if (gameDeleted) {
      navigate(ROUTES.HOME, { replace: true, viewTransition: true });
    }
  }, [viewingNodeId, activeGame, confirm, deleteBranch, navigate, t]);

  const handleRedoScene = useCallback(async () => {
    if (!viewingNodeId || !activeGame) return;
    const nodesById = new Map(useGameStore.getState().nodes.map((n) => [n.id as string, n]));
    const target = nodesById.get(viewingNodeId);
    if (!target) return;
    if (target.parentNodeId === null) {
      // Root redo: a new save slot with a regenerated first scene.
      const result = await confirm({
        title: t("redoSceneButtonLabel"),
        message: t("redoRootConfirmMessage"),
        confirmLabel: t("redoRootConfirmLabel"),
        cancelLabel: t("cancelButton"),
      });
      if (result !== true) return;
      await redoScene(viewingNodeId, false);
      return;
    }
    if (!target.choiceText) return;
    // Non-root redo: Keep = re-roll with full context, Discard = re-roll and
    // permanently cut the prompt history older than the new scene.
    const result = await confirm({
      title: t("redoSceneButtonLabel"),
      message: t("redoSceneConfirmMessage"),
      confirmLabel: t("redoSceneConfirmKeep"),
      neutralLabel: t("redoSceneConfirmDiscard"),
      cancelLabel: t("cancelButton"),
    });
    if (result !== true && result !== "neutral") return;
    await redoScene(viewingNodeId, result === "neutral");
  }, [viewingNodeId, activeGame, confirm, redoScene, t]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (isShortcutBlocked(document.activeElement)) {
        return;
      }
      if (busy) {
        return;
      }

      switch (e.key) {
        case "r":
        case "R":
          e.preventDefault();
          if (imageGenerator !== "disabled" && viewingNodeId) {
            void regenerateImage(viewingNodeId);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (canGoBack) {
            onNavigateBack();
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (canGoForward) {
            onNavigateForward();
          }
          break;
        case "l":
        case "L":
          e.preventDefault();
          if (!isAtLatest) {
            onGoToLatest();
          }
          break;
        case "h":
        case "H":
          e.preventDefault();
          handleSwitchToHistory();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    busy,
    imageGenerator,
    viewingNodeId,
    regenerateImage,
    canGoBack,
    canGoForward,
    isAtLatest,
    onNavigateBack,
    onNavigateForward,
    onGoToLatest,
    handleSwitchToHistory,
  ]);

  return (
    <>
      <Button
        onClick={onNavigateBack}
        disabled={!canGoBack || busy}
        intent="circle"
        aria-label={t("previousSceneButtonLabel")}
        title={t("previousSceneButtonLabel")}
      >
        <Icon iconName="keyboard_arrow_left" />
      </Button>

      <Button
        onClick={onNavigateForward}
        disabled={!canGoForward || busy}
        intent="circle"
        aria-label={t("nextSceneButtonLabel")}
        title={t("nextSceneButtonLabel")}
      >
        <Icon iconName="keyboard_arrow_right" />
      </Button>

      {imageGenerator !== "disabled" ? (
        <Button
          onClick={() => viewingNodeId && void regenerateImage(viewingNodeId)}
          disabled={busy}
          intent="circle"
          aria-label={t("regenerateImageLabel")}
          title={t("regenerateImageLabel")}
        >
          <Icon iconName="autorenew" />
        </Button>
      ) : (
        <div className="size-10" />
      )}

      <div className="relative flex items-center justify-center" ref={menuRef}>
        <Button
          onClick={() => setMenuOpen((prev) => !prev)}
          intent="circle"
          className={`${menuOpen ? "rotate-90 bg-lime-600/20 text-lime-600 dark:bg-lime-400/20 dark:text-lime-400" : ""}`}
          aria-label={t("moreMenuButtonLabel")}
          title={t("moreMenuButtonLabel")}
        >
          <Icon iconName="more_horiz" />
        </Button>

        {menuOpen && (
          <div className="animate-fade-in absolute top-full right-0 z-50 mt-2 grid grid-cols-[repeat(4,max-content)] gap-3 rounded-3xl border border-zinc-200 bg-white/95 p-2 shadow-xl backdrop-blur-md md:top-auto md:bottom-full md:mb-2 dark:border-zinc-800 dark:bg-zinc-900/95">
            <Button
              onClick={() => closeMenuAnd(toggleAutoplay)}
              disabled={busy}
              intent="circle"
              className={
                autoplay
                  ? "bg-lime-600/20 text-lime-600 dark:bg-lime-400/20 dark:text-lime-400"
                  : ""
              }
              aria-label={autoplay ? t("stopAutoplayButtonLabel") : t("autoplayButtonLabel")}
              title={autoplay ? t("stopAutoplayButtonLabel") : t("autoplayButtonLabel")}
            >
              <Icon iconName={autoplay ? "autostop" : "autoplay"} />
            </Button>

            <Button
              onClick={() => closeMenuAnd(handleSwitchToHistory)}
              disabled={busy}
              intent="circle"
              aria-label={t("historyButtonLabel")}
              title={t("historyButtonLabel")}
            >
              <Icon iconName="import_contacts" />
            </Button>

            <Button
              onClick={() => closeMenuAnd(onGoToLatest)}
              disabled={isAtLatest || busy}
              intent="circle"
              aria-label={t("goToLatestSceneButtonLabel")}
              title={t("goToLatestSceneButtonLabel")}
            >
              <Icon iconName="last_page" />
            </Button>

            <Button
              intent="circle"
              disabled={busy}
              onClick={() => closeMenuAnd(onOpenRefine)}
              title={t("refineSceneButtonLabel")}
              aria-label={t("refineSceneButtonLabel")}
            >
              <Icon iconName="auto_awesome_mosaic" />
            </Button>

            <Button
              intent="circle"
              disabled={busy}
              onClick={() => closeMenuAnd(onOpenEdit)}
              title={t("editSceneButtonLabel")}
              aria-label={t("editSceneButtonLabel")}
            >
              <Icon iconName="edit" />
            </Button>

            <Button
              intent="circle"
              disabled={busy}
              onClick={() => closeMenuAnd(() => void handleRedoScene())}
              title={t("redoSceneButtonLabel")}
              aria-label={t("redoSceneButtonLabel")}
            >
              <Icon iconName="redo" />
            </Button>

            <Button
              intent="circle"
              disabled={busy}
              onClick={() => closeMenuAnd(() => void handleDeleteBranch())}
              title={t("deleteBranchConfirmTitle")}
              aria-label={t("deleteBranchConfirmTitle")}
            >
              <Icon iconName="delete_forever" />
            </Button>

            <Button
              intent="circle"
              disabled={busy}
              onClick={() => closeMenuAnd(() => void handleHome())}
              title={t("returnToStartButton")}
              aria-label={t("returnToStartButton")}
            >
              <Icon iconName="home" />
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

export default GameNavButtons;

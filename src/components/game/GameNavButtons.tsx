import React, { useCallback, useEffect, useRef, useState } from "react";
import Button from "../ui/Button";
import { useGameNavigation } from "../../hooks/useGameNavigation";
import { useGameStore } from "../../store/gameStore";
import { useNavigate } from "react-router";
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
 * Scene navigation buttons + overflow menu (legacy GameNavButtons, ported to
 * the v2 store. Autoplay/editing arrive in a later phase; refine and delete
 * branch live in the menu).
 */
const GameNavButtons: React.FC<{ onOpenRefine: () => void }> = ({ onOpenRefine }) => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const generation = useGameStore((s) => s.generation);
  const imageRegeneration = useGameStore((s) => s.imageRegeneration);
  const settings = useGameStore((s) => s.settings);
  const activeGame = useGameStore((s) => s.activeGame);
  const viewingNodeId = useGameStore((s) => s.viewingNodeId);
  const regenerateImage = useGameStore((s) => s.regenerateImage);
  const goToTitle = useGameStore((s) => s.goToTitle);
  const deleteBranch = useGameStore((s) => s.deleteBranch);

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
      title: "Delete Branch",
      message:
        "Delete this branch? The scene and all of its descendants (including images) will be removed. This cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      isDestructive: true,
      icon: "delete_forever",
    });
    if (result !== true) return;
    const { gameDeleted } = await deleteBranch(viewingNodeId);
    if (gameDeleted) {
      navigate(ROUTES.HOME, { replace: true, viewTransition: true });
    }
  }, [viewingNodeId, activeGame, confirm, deleteBranch, navigate]);

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
        aria-label="Previous Scene"
        title="Previous Scene"
      >
        <Icon iconName="keyboard_arrow_left" />
      </Button>

      <Button
        onClick={onNavigateForward}
        disabled={!canGoForward || busy}
        intent="circle"
        aria-label="Next Scene"
        title="Next Scene"
      >
        <Icon iconName="keyboard_arrow_right" />
      </Button>

      {imageGenerator !== "disabled" ? (
        <Button
          onClick={() => viewingNodeId && void regenerateImage(viewingNodeId)}
          disabled={busy}
          intent="circle"
          aria-label="Regenerate Image with New Seed"
          title="Regenerate Image with New Seed"
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
          aria-label="More Options"
          title="More Options"
        >
          <Icon iconName="more_horiz" />
        </Button>

        {menuOpen && (
          <div className="animate-fade-in absolute top-full right-0 z-50 mt-2 flex items-center gap-3 rounded-full border border-zinc-200 bg-white/95 p-2 shadow-xl backdrop-blur-md md:top-auto md:bottom-full md:mb-2 dark:border-zinc-800 dark:bg-zinc-900/95">
            <Button
              onClick={() => closeMenuAnd(handleSwitchToHistory)}
              disabled={busy}
              intent="circle"
              aria-label="View History"
              title="View History"
            >
              <Icon iconName="import_contacts" />
            </Button>

            <Button
              onClick={() => closeMenuAnd(onGoToLatest)}
              disabled={isAtLatest || busy}
              intent="circle"
              aria-label="Go to Latest Scene"
              title="Go to Latest Scene"
            >
              <Icon iconName="last_page" />
            </Button>

            <Button
              intent="circle"
              disabled={busy}
              onClick={() => closeMenuAnd(onOpenRefine)}
              title="Refine Scene with AI"
              aria-label="Refine Scene with AI"
            >
              <Icon iconName="auto_awesome_mosaic" />
            </Button>

            <Button
              intent="circle"
              disabled={busy}
              onClick={() => closeMenuAnd(() => void handleDeleteBranch())}
              title="Delete Branch"
              aria-label="Delete Branch"
            >
              <Icon iconName="delete_forever" />
            </Button>

            <Button
              intent="circle"
              disabled={busy}
              onClick={() => closeMenuAnd(() => void handleHome())}
              title="Return to Start Screen"
              aria-label="Return to Start Screen"
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

import Button from "./ui/Button";
import { Icon, type IconName } from "./ui/Icon";
import LoadingSpinner from "./ui/LoadingSpinner";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { applyLoadScreenFallback } from "./game/imageFallbacks";
import {
  CARD_PREVIEW_MAX_LENGTH,
  CARD_TITLE_MAX_LENGTH,
  IMAGE_ALT_MAX_LENGTH,
  truncateText,
} from "../lib/truncateText";

// LoadScreenとHistoryScreenの共通パーツ

export interface StoryCardMenuItem {
  id: string;
  label: string;
  icon: IconName;
  onSelect: () => void;
  isDestructive?: boolean;
  disabled?: boolean;
}

interface StoryCardProps {
  imageUrl: string | null;
  imageAlt: string;
  isLoadingImage: boolean;
  actions?: React.ReactNode;
  onImageClick?: () => void;
  /** Single action used when `menuItems` is not provided (backward compatible). */
  onMenuClick?: () => void;
  menuText?: string;
  menuItems?: StoryCardMenuItem[];
  mainText?: string;
  subText?: string;
  timeText?: React.ReactNode;
}

const StoryCard: React.FC<StoryCardProps> = ({
  imageUrl,
  imageAlt,
  isLoadingImage,
  actions,
  onImageClick,
  onMenuClick,
  menuText,
  menuItems,
  mainText,
  subText,
  timeText,
}) => {
  const { t } = useTranslation();
  const resolvedMenuText = menuText ?? t("deleteButton");
  const hasMenu = Boolean(menuItems && menuItems.length > 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const menuAriaLabel = hasMenu ? t("moreMenuButtonLabel") : resolvedMenuText;
  // Defense in depth: callers pass previews, but a tens-of-KB title/theme
  // text must never reach the DOM in full (line-clamp only hides it
  // visually). Truncate here so every card stays bounded.
  const displayMainText = useMemo(
    () => (mainText ? truncateText(mainText, CARD_TITLE_MAX_LENGTH) : mainText),
    [mainText],
  );
  const displaySubText = useMemo(
    () => (subText ? truncateText(subText, CARD_PREVIEW_MAX_LENGTH) : subText),
    [subText],
  );
  const displayImageAlt = useMemo(() => truncateText(imageAlt, IMAGE_ALT_MAX_LENGTH), [imageAlt]);
  return (
    <div className="text-bg-color relative flex h-full flex-col rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl">
      <div className="relative overflow-hidden rounded-t-lg bg-text-bg">
        {isLoadingImage ? (
          <div className="flex aspect-video size-full items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <img
            src={imageUrl || undefined}
            alt={displayImageAlt}
            loading="lazy"
            decoding="async"
            className={`animate-fade-in aspect-video size-full object-cover ${!onImageClick ? "" : "cursor-pointer"}`}
            onError={applyLoadScreenFallback}
            onClick={onImageClick}
          />
        )}
        <div className="pointer-events-none absolute inset-0 opacity-40 shadow-[inset_0_0_40px_#000,inset_0_0_80px_#000]"></div>
      </div>
      <div ref={menuRef} className="absolute top-1 right-1 z-20">
        <Button
          intent="overlay-circle"
          onClick={hasMenu ? () => setMenuOpen((prev) => !prev) : onMenuClick}
          title={menuAriaLabel}
          aria-label={menuAriaLabel}
          aria-haspopup={hasMenu ? "menu" : undefined}
          aria-expanded={hasMenu ? menuOpen : undefined}
        >
          <Icon iconName="more_horiz" className="text-white" />
        </Button>
        {hasMenu && menuOpen && (
          <div
            role="menu"
            aria-label={menuAriaLabel}
            className="animate-fade-in absolute top-full right-0 z-50 mt-1 flex w-max min-w-40 flex-col gap-1 rounded-xl border border-zinc-200 bg-white/95 p-1 shadow-xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95"
          >
            {menuItems?.map((menuItem) => (
              <button
                key={menuItem.id}
                type="button"
                role="menuitem"
                aria-label={menuItem.label}
                title={menuItem.label}
                disabled={menuItem.disabled}
                onClick={() => {
                  setMenuOpen(false);
                  menuItem.onSelect();
                }}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  menuItem.isDestructive
                    ? "text-danger hover:bg-danger/10"
                    : "text-body-text hover:bg-text-support/10"
                }`}
              >
                <Icon iconName={menuItem.icon} className="text-xl" />
                <span>{menuItem.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="m-4 flex-1 space-y-2">
        {timeText && <div>{timeText}</div>}
        <div className="line-clamp-2 min-h-12 font-semibold wrap-anywhere">{displayMainText}</div>
        <div className="support-text-color line-clamp-3 min-h-15 text-sm wrap-anywhere">
          {displaySubText}
        </div>
        {actions && <div>{actions}</div>}
      </div>
    </div>
  );
};

export default StoryCard;

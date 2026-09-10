import Button from "./ui/Button";
import { Icon } from "./ui/Icon";
import LoadingSpinner from "./ui/LoadingSpinner";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CARD_PREVIEW_MAX_LENGTH,
  CARD_TITLE_MAX_LENGTH,
  IMAGE_ALT_MAX_LENGTH,
  truncateText,
} from "../lib/truncateText";

// LoadScreenとHistoryScreenの共通パーツ

interface StoryCardProps {
  imageUrl: string | null;
  imageAlt: string;
  isLoadingImage: boolean;
  actions?: React.ReactNode;
  onImageError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onImageClick?: () => void;
  onMenuClick?: () => void;
  menuText?: string;
  mainText?: string;
  subText?: string;
  timeText?: React.ReactNode;
}

const StoryCard: React.FC<StoryCardProps> = ({
  imageUrl,
  imageAlt,
  isLoadingImage,
  actions,
  onImageError,
  onImageClick,
  onMenuClick,
  menuText,
  mainText,
  subText,
  timeText,
}) => {
  const { t } = useTranslation();
  const resolvedMenuText = menuText ?? t("deleteButton");
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
    <div className="text-bg-color flex h-full flex-col overflow-hidden rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl">
      <div className="relative bg-text-bg">
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
            className={`aspect-video size-full object-cover ${!onImageClick ? "" : "cursor-pointer"}`}
            onError={onImageError}
            onClick={onImageClick}
          />
        )}
        <div className="pointer-events-none absolute inset-0 opacity-40 shadow-[inset_0_0_40px_#000,inset_0_0_80px_#000]"></div>
        <Button
          intent="overlay-circle"
          className="absolute top-1 right-1"
          onClick={onMenuClick}
          title={resolvedMenuText}
          aria-label={resolvedMenuText}
        >
          <Icon iconName="more_horiz" className="text-white" />
        </Button>
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

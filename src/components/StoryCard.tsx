import Button from "./ui/Button";
import { Icon } from "./ui/Icon";
import LoadingSpinner from "./ui/LoadingSpinner";
import React from "react";
import { useTranslation } from "react-i18next";

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
  return (
    <div className="text-bg-color flex h-full flex-col overflow-hidden rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl">
      <div className="bg-text-bg relative">
        {isLoadingImage ? (
          <div className="flex aspect-video h-full w-full items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <img
            src={imageUrl || undefined}
            alt={imageAlt}
            className={`aspect-video h-full w-full object-cover ${!onImageClick ? "" : "cursor-pointer"}`}
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
        <div className="line-clamp-2 min-h-12 font-semibold">{mainText}</div>
        <div className="support-text-color line-clamp-3 min-h-15 text-sm">{subText}</div>
        {actions && <div>{actions}</div>}
      </div>
    </div>
  );
};

export default StoryCard;

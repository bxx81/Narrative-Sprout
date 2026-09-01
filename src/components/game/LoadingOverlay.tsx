import LoadingSpinner from "../ui/LoadingSpinner";
import { useTranslation } from "react-i18next";

export type SpinnerState = "Scene" | "Image" | "Choice" | "Autoplay" | null;

interface LoadingOverlayProps {
  isPageLoading: boolean;
  spinnerState: SpinnerState;
  imageGenerationProgress: number | null;
  imageGenerator: string;
  error: boolean;
  /** ストリーミング中など本文をライブ表示する際、オーバーレイを隠す */
  suppressed?: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isPageLoading,
  spinnerState,
  imageGenerationProgress,
  imageGenerator,
  error,
  suppressed = false,
}) => {
  const { t } = useTranslation();
  const isVisible = isPageLoading && !error && !suppressed;

  const nowProgress =
    spinnerState === "Image" &&
    (imageGenerator === "a1111" || imageGenerator === "comfyui") &&
    imageGenerationProgress !== null;

  if (!isVisible) return null;

  const spinnerLabel =
    spinnerState === "Scene"
      ? t("loadingScene")
      : spinnerState === "Image"
        ? t("loadingImage")
        : spinnerState === "Choice"
          ? t("loadingChoice")
          : t("loadingAutoplay");

  return (
    <div className="animate-fade-in pointer-events-none fixed inset-0 z-110 flex items-center justify-center will-change-auto">
      <div className="border-text-border/80 bg-text-bg/80 flex flex-col items-center gap-6 rounded-3xl border p-10 shadow-2xl">
        <div className="relative flex items-center justify-center will-change-transform">
          <LoadingSpinner
            className="size-20 text-lime-600 dark:text-lime-400"
            progress={nowProgress ? imageGenerationProgress : null}
          />
          {nowProgress && (
            <div className="text-text-text absolute text-lg font-bold">
              {Math.round(Math.max(0, Math.min(100, imageGenerationProgress * 100)))}%
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-text-text animate-pulse font-[Inter] text-xs tracking-[0.2em]">
            {spinnerLabel}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;

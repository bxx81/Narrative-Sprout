import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../store/gameStore";
import { ROUTES } from "../app/routes";
import Button from "../components/ui/Button";
import { guideUrl, licenseUrl, privacyUrl, termsUrl } from "../lib/cloudFlarePages";

// セーブデータがある場合に「続きから」ボタンが表示される

const FALLBACK_BG_SVG_RAW = `<svg xmlns='http://www.w3.org/2000/svg' width='100%'><defs><linearGradient id='a' gradientUnits='userSpaceOnUse' x1='0' x2='0' y1='0' y2='100%' gradientTransform='rotate(240)'><stop offset='0' stop-color='#9C9BA2'/><stop offset='1' stop-color='#EFEEE6'/></linearGradient><pattern patternUnits='userSpaceOnUse' id='b' width='540' height='450' x='0' y='0' viewBox='0 0 1080 900'><g fill-opacity='0.1'><polygon fill='#444' points='90 150 0 300 180 300'/><polygon points='90 150 180 0 0 0'/><polygon fill='#AAA' points='270 150 360 0 180 0'/><polygon fill='#DDD' points='450 150 360 300 540 300'/><polygon fill='#999' points='450 150 540 0 360 0'/><polygon points='630 150 540 300 720 300'/><polygon fill='#DDD' points='630 150 720 0 540 0'/><polygon fill='#444' points='810 150 720 300 900 300'/><polygon fill='#FFF' points='810 150 900 0 720 0'/><polygon fill='#DDD' points='990 150 900 300 1080 300'/><polygon fill='#444' points='990 150 1080 0 900 0'/><polygon fill='#DDD' points='90 450 0 600 180 600'/><polygon points='90 450 180 300 0 300'/><polygon fill='#666' points='270 450 180 600 360 600'/><polygon fill='#AAA' points='270 450 360 300 180 300'/><polygon fill='#DDD' points='450 450 360 600 540 600'/><polygon fill='#999' points='450 450 540 300 360 300'/><polygon fill='#999' points='630 450 540 600 720 600'/><polygon fill='#FFF' points='630 450 720 300 540 300'/><polygon points='810 450 720 600 900 600'/><polygon fill='#DDD' points='810 450 900 300 720 300'/><polygon fill='#AAA' points='990 450 900 600 1080 600'/><polygon fill='#444' points='990 450 1080 300 900 300'/><polygon fill='#222' points='90 750 0 900 180 900'/><polygon points='270 750 180 900 360 900'/><polygon fill='#DDD' points='270 750 360 600 180 600'/><polygon points='450 750 540 600 360 600'/><polygon points='630 750 540 900 720 900'/><polygon fill='#444' points='630 750 720 600 540 600'/><polygon fill='#AAA' points='810 750 720 900 900 900'/><polygon fill='#666' points='810 750 900 600 720 600'/><polygon points='990 750 900 900 1080 900'/></g></pattern></defs><rect fill='url(#a)' width='100%' height='100%'/><rect fill='url(#b)' width='100%' height='100%'/></svg>`;

const FALLBACK_BG_URL = `data:image/svg+xml;base64,${typeof window !== "undefined" ? window.btoa(FALLBACK_BG_SVG_RAW) : ""}`;

const REPOSITORY_URL = "https://github.com/bxx81/Narrative-Sprout";

const GITHUB_ICON = (
  <svg width="16" height="16" viewBox="0 0 98 96" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0_730_27136)">
      <path
        d="M41.4395 69.3848C28.8066 67.8535 19.9062 58.7617 19.9062 46.9902C19.9062 42.2051 21.6289 37.0371 24.5 33.5918C23.2559 30.4336 23.4473 23.7344 24.8828 20.959C28.7109 20.4805 33.8789 22.4902 36.9414 25.2656C40.5781 24.1172 44.4062 23.543 49.0957 23.543C53.7852 23.543 57.6133 24.1172 61.0586 25.1699C64.0254 22.4902 69.2891 20.4805 73.1172 20.959C74.457 23.543 74.6484 30.2422 73.4043 33.4961C76.4668 37.1328 78.0937 42.0137 78.0937 46.9902C78.0937 58.7617 69.1934 67.6621 56.3691 69.2891C59.623 71.3945 61.8242 75.9883 61.8242 81.252L61.8242 91.2051C61.8242 94.0762 64.2168 95.7031 67.0879 94.5547C84.4102 87.9512 98 70.6289 98 49.1914C98 22.1074 75.9883 6.69539e-07 48.9043 4.309e-07C21.8203 1.92261e-07 -1.9479e-07 22.1074 -4.3343e-07 49.1914C-6.20631e-07 70.4375 13.4941 88.0469 31.6777 94.6504C34.2617 95.6074 36.75 93.8848 36.75 91.3008L36.75 83.6445C35.4102 84.2188 33.6875 84.6016 32.1562 84.6016C25.8398 84.6016 22.1074 81.1563 19.4277 74.7441C18.375 72.1602 17.2266 70.6289 15.0254 70.3418C13.877 70.2461 13.4941 69.7676 13.4941 69.1934C13.4941 68.0449 15.4082 67.1836 17.3223 67.1836C20.0977 67.1836 22.4902 68.9063 24.9785 72.4473C26.8926 75.2227 28.9023 76.4668 31.2949 76.4668C33.6875 76.4668 35.2187 75.6055 37.4199 73.4043C39.0469 71.7773 40.291 70.3418 41.4395 69.3848Z"
        fill="white"
      />
    </g>
    <defs>
      <clipPath id="clip0_730_27136">
        <rect width="98" height="96" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

/**
 * The main start screen of the application.
 */
const TitleScreen: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const games = useGameStore((s) => s.games);
  const apiKey = useGameStore((s) => s.openrouterApiKey);
  const openGame = useGameStore((s) => s.openGame);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);

  useEffect(() => {
    const getAspectRatio = () => {
      const ratio = window.innerWidth / window.innerHeight;
      if (ratio > 1.2) return "16_9"; // Landscape
      if (ratio < 0.8) return "9_16"; // Portrait
      return "1_1"; // Square-ish
    };

    // There are 49 images, named 1.webp to 49.webp
    const imageId = Math.floor(Math.random() * 49) + 1;
    const aspectRatioFolder = getAspectRatio();
    const path = `/images/${aspectRatioFolder}/${imageId}.webp`;

    const img = new Image();
    img.onload = () => {
      setBackgroundUrl(path);
    };
    img.onerror = () => {
      setBackgroundUrl(FALLBACK_BG_URL);
    };
    img.src = path;
  }, []);

  const handleBegin = () => {
    if (!apiKey) {
      navigate(ROUTES.SETTINGS, { state: { from: ROUTES.HOME } });
      return;
    }
    navigate(ROUTES.SETUP, { viewTransition: true });
  };

  const handleContinue = async () => {
    const latest = games[0];
    if (!latest) return;
    await openGame(latest.id);
    navigate(ROUTES.PLAY, { viewTransition: true });
  };

  const handleLoad = () => {
    navigate(ROUTES.LOAD, { viewTransition: true });
  };

  const hasSaves = games.length > 0;

  return (
    <div className="relative isolate flex min-h-[85vh] w-full flex-col text-center">
      <div
        data-testid="background-div"
        className="fixed inset-0 z-[-1] bg-cover bg-center"
        style={{
          backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
          filter: "blur(4px) brightness(0.6)",
          transform: "scale(1.05)", // Prevents blurred edges from showing
          animation: backgroundUrl ? "fadeIn 1s forwards" : "none",
          opacity: backgroundUrl ? undefined : 0,
        }}
      />
      <div className="flex grow flex-col items-center justify-center">
        <h1 className="font-serif-display text-title-text mb-4 text-[clamp(1.5rem,7.5vw,3rem)] leading-none font-bold drop-shadow-lg md:text-[clamp(3rem,6vw,5rem)]">
          {t("title")}
        </h1>
        <p className="text-title-text mx-auto mb-12 max-w-2xl text-lg drop-shadow-md [line-break:strict] md:text-xl">
          {t("description")}
        </p>
        <nav className="flex flex-col gap-4 sm:flex-row">
          {hasSaves ? (
            <>
              <Button onClick={() => void handleContinue()} intent="primary" size="large">
                {t("continueStoryButton")}
              </Button>
              <Button onClick={handleBegin} intent="secondary" size="large">
                {t("beginStoryButton")}
              </Button>
              <Button onClick={handleLoad} disabled={!hasSaves} intent="secondary" size="large">
                {t("loadStoryButton")}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleBegin} intent="primary" size="large">
                {t("beginStoryButton")}
              </Button>
              <Button onClick={handleLoad} disabled intent="secondary" size="large">
                {t("loadStoryButton")}
              </Button>
            </>
          )}
        </nav>
      </div>
      <footer className="w-full py-4 text-center">
        <div className="sm:flex flex-col sm:justify-center sm:flex-row gap-x-4">
          <div>
            <a
              href={guideUrl}
              target="_blank"
              rel="noopener noreferrer help"
              className="document-link"
            >
              {t("guideLink", { defaultValue: "User Guide" })}
            </a>
          </div>
          <div>
            <a
              href={privacyUrl}
              target="_blank"
              rel="noopener noreferrer privacy-policy"
              className="document-link"
            >
              {t("privacyLink", { defaultValue: "Privacy Policy" })}
            </a>
          </div>
          <div>
            <a
              href={termsUrl}
              target="_blank"
              rel="noopener noreferrer terms-of-service"
              className="document-link"
            >
              {t("termsLink", { defaultValue: "Terms of Service" })}
            </a>
          </div>
          <div>
            <a
              href={licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="document-link"
            >
              {t("ossLicenseLink", { defaultValue: "OSS License" })}
            </a>
          </div>
        </div>
        <div className="mt-2 flex justify-center">
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={t("githubRepositoryLink", { defaultValue: "GitHub Repository" })}
          >
            {GITHUB_ICON}
          </a>
        </div>
        <div>
          <a
            href={REPOSITORY_URL + "/commits/main/"}
            target="_blank"
            rel="noopener noreferrer"
            className="version-link"
          >
            Version: {__APP_VERSION__}
          </a>
        </div>
      </footer>
    </div>
  );
};

export default TitleScreen;

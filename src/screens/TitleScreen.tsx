import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useGameStore } from "../store/gameStore";
import { ROUTES } from "../app/routes";
import Button from "../components/ui/Button";

// セーブデータがある場合に「続きから」ボタンが表示される

const FALLBACK_BG_SVG_RAW = `<svg xmlns='http://www.w3.org/2000/svg' width='100%'><defs><linearGradient id='a' gradientUnits='userSpaceOnUse' x1='0' x2='0' y1='0' y2='100%' gradientTransform='rotate(240)'><stop offset='0' stop-color='#9C9BA2'/><stop offset='1' stop-color='#EFEEE6'/></linearGradient><pattern patternUnits='userSpaceOnUse' id='b' width='540' height='450' x='0' y='0' viewBox='0 0 1080 900'><g fill-opacity='0.1'><polygon fill='#444' points='90 150 0 300 180 300'/><polygon points='90 150 180 0 0 0'/><polygon fill='#AAA' points='270 150 360 0 180 0'/><polygon fill='#DDD' points='450 150 360 300 540 300'/><polygon fill='#999' points='450 150 540 0 360 0'/><polygon points='630 150 540 300 720 300'/><polygon fill='#DDD' points='630 150 720 0 540 0'/><polygon fill='#444' points='810 150 720 300 900 300'/><polygon fill='#FFF' points='810 150 900 0 720 0'/><polygon fill='#DDD' points='990 150 900 300 1080 300'/><polygon fill='#444' points='990 150 1080 0 900 0'/><polygon fill='#DDD' points='90 450 0 600 180 600'/><polygon points='90 450 180 300 0 300'/><polygon fill='#666' points='270 450 180 600 360 600'/><polygon fill='#AAA' points='270 450 360 300 180 300'/><polygon fill='#DDD' points='450 450 360 600 540 600'/><polygon fill='#999' points='450 450 540 300 360 300'/><polygon fill='#999' points='630 450 540 600 720 600'/><polygon fill='#FFF' points='630 450 720 300 540 300'/><polygon points='810 450 720 600 900 600'/><polygon fill='#DDD' points='810 450 900 300 720 300'/><polygon fill='#AAA' points='990 450 900 600 1080 600'/><polygon fill='#444' points='990 450 1080 300 900 300'/><polygon fill='#222' points='90 750 0 900 180 900'/><polygon points='270 750 180 900 360 900'/><polygon fill='#DDD' points='270 750 360 600 180 600'/><polygon points='450 750 540 600 360 600'/><polygon points='630 750 540 900 720 900'/><polygon fill='#444' points='630 750 720 600 540 600'/><polygon fill='#AAA' points='810 750 720 900 900 900'/><polygon fill='#666' points='810 750 900 600 720 600'/><polygon points='990 750 900 900 1080 900'/></g></pattern></defs><rect fill='url(#a)' width='100%' height='100%'/><rect fill='url(#b)' width='100%' height='100%'/></svg>`;

const FALLBACK_BG_URL = `data:image/svg+xml;base64,${typeof window !== "undefined" ? window.btoa(FALLBACK_BG_SVG_RAW) : ""}`;

const REPOSITORY_URL = "https://github.com/bxx81/Narrative-Sprout";

/**
 * The main start screen of the application.
 */
const TitleScreen: React.FC = () => {
  const navigate = useNavigate();
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
          Narrative Sprout
        </h1>
        <p className="text-title-text mx-auto mb-12 max-w-2xl text-lg drop-shadow-md [line-break:strict] md:text-xl">
          Create unique stories in a world of your own design. Set the theme for your story, and AI
          will bring it to life with dynamic narratives and visuals.
        </p>
        <nav className="flex flex-col gap-4 sm:flex-row">
          {hasSaves ? (
            <>
              <Button onClick={() => void handleContinue()} intent="primary" size="large">
                Continue
              </Button>
              <Button onClick={handleBegin} intent="secondary" size="large">
                New Story
              </Button>
              <Button onClick={handleLoad} disabled={!hasSaves} intent="secondary" size="large">
                Load
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleBegin} intent="primary" size="large">
                New Story
              </Button>
              <Button onClick={handleLoad} disabled intent="secondary" size="large">
                Load
              </Button>
            </>
          )}
        </nav>
      </div>
      <footer className="w-full py-4 text-center">
        <div className="flex flex-row justify-center gap-4">
          <div>
            <a
              href={REPOSITORY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="document-link"
            >
              GitHub Repository
            </a>
          </div>
        </div>
        <div>
          <a
            href={REPOSITORY_URL + "/releases"}
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

import React, { useEffect, useRef } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { Toaster, useToasterStore } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import i18n from "../features/i18n/config";
import { getLanguageCode, applyLanguageDocumentEffects } from "../features/i18n/api";
import { setWordCountLanguage } from "../features/narrative/api";
import { playSound } from "../features/sound/api";
import { useGameStore } from "../store/gameStore";
import ErrorDialog from "../components/ErrorDialog";
import { ROUTES, isNeedPadding, isVisibleSettingsButton } from "./routes";
import { ConfirmationProvider } from "./ConfirmationProvider";
import Button from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import TitleScreen from "../screens/TitleScreen";
import ThemeSetupScreen from "../screens/ThemeSetupScreen";
import StartingScreen from "../screens/StartingScreen";
import GameScreen from "../screens/GameScreen";
import LoadScreen from "../screens/LoadScreen";
import HistoryScreen from "../screens/HistoryScreen";
import ChronicleScreen from "../screens/ChronicleScreen";
import SettingsScreen from "../screens/SettingsScreen";
import CompletedDataDeletionScreen from "../screens/CompletedDataDeletionScreen";

/** Redirects to the title screen when no game is loaded in memory. */
function RequireActiveGame() {
  const activeGame = useGameStore((s) => s.activeGame);
  if (!activeGame) {
    return <Navigate to={ROUTES.HOME} replace />;
  }
  return <Outlet />;
}

/** Plays the notification chime whenever a new toast appears. */
function ToastSoundPlayer() {
  const toasts = useToasterStore().toasts;
  const announcedToastIds = useRef(new Set<string>());
  useEffect(() => {
    for (const toast of toasts) {
      if (!announcedToastIds.current.has(toast.id)) {
        announcedToastIds.current.add(toast.id);
        playSound("notification");
      }
    }
  }, [toasts]);
  return null;
}

export function App() {
  const bootstrap = useGameStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Dark mode follows the OS preference (legacy behavior)
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle("dark", mediaQuery.matches);
    };
    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, []);

  // F11 fullscreen shortcut (legacy behavior)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else {
          void document.documentElement.requestFullscreen();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <BrowserRouter>
      <ConfirmationProvider>
        <AppLayout />
      </ConfirmationProvider>
    </BrowserRouter>
  );
}

const AppLayout: React.FC = () => {
  const { t } = useTranslation();
  const settings = useGameStore((s) => s.settings);
  const settingsLoaded = useGameStore((s) => s.settings !== null);
  const location = useLocation();
  const navigate = useNavigate();

  // Apply the UI language to i18next and the document (html lang, text
  // direction, per-language fonts). AI translation bundles are merged into
  // the resource bundle before switching (legacy applyLanguage).
  const uiLanguage = settings?.uiLanguage;
  const aiLanguageMappings = settings?.aiLanguageMappings;
  const aiTranslationTexts = settings ? settings.aiTranslations[settings.uiLanguage] : undefined;
  useEffect(() => {
    if (!settings) return;
    const languageCode = getLanguageCode(settings.uiLanguage, settings.aiLanguageMappings);
    if (aiTranslationTexts) {
      i18n.addResourceBundle(languageCode, "translation", aiTranslationTexts, true, true);
    }
    void i18n.changeLanguage(languageCode);
    applyLanguageDocumentEffects(settings.uiLanguage, settings.aiLanguageMappings);
    // The word counter follows the narrative language (legacy langCode
    // passed to the Intl.Segmenter word count).
    setWordCountLanguage(getLanguageCode(settings.language, settings.aiLanguageMappings));
  }, [settings, uiLanguage, aiLanguageMappings, aiTranslationTexts]);

  // Full data wipe reloads the app with this flag set; show the completion
  // screen instead of the routed screen.
  if (sessionStorage.getItem("nsDataDeletionComplete") === "1") {
    return <CompletedDataDeletionScreen />;
  }

  if (!settingsLoaded) {
    return (
      <div className="bg-body-bg flex h-screen items-center justify-center">
        <p className="support-text-color">{t("toastLoading")}</p>
      </div>
    );
  }

  const padding = isNeedPadding(location.pathname);
  const visibleSettingsButton = isVisibleSettingsButton(location.pathname);

  const handleSettingsClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    navigate(ROUTES.SETTINGS, { state: { from: location.pathname } });
  };

  return (
    <div
      className={`min-h-screen antialiased transition-colors duration-300 select-none ${padding ? "p-4" : ""}`}
    >
      <Routes>
        <Route path={ROUTES.HOME} element={<TitleScreen />} />
        <Route path={ROUTES.SETUP} element={<ThemeSetupScreen />} />
        <Route path={ROUTES.STARTING} element={<StartingScreen />} />
        <Route path={ROUTES.LOAD} element={<LoadScreen />} />
        <Route path={ROUTES.SETTINGS} element={<SettingsScreen />} />
        <Route element={<RequireActiveGame />}>
          <Route path={ROUTES.PLAY} element={<GameScreen />} />
          <Route path={ROUTES.HISTORY} element={<HistoryScreen />} />
          <Route path={ROUTES.CHRONICLE} element={<ChronicleScreen />} />
        </Route>
        <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
      </Routes>

      <ErrorDialog />

      <ToastSoundPlayer />

      {/* Legacy-styled top-center notification toasts (auto-close) */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#fff",
            color: "#000",
            fontSize: "12px",
            padding: "12px 16px",
            borderRadius: "8px",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
          },
        }}
      />

      <Button
        onClick={handleSettingsClick}
        intent="navigator"
        size="medium-circle"
        className={`fixed right-6 bottom-6 duration-300 ease-in-out ${
          visibleSettingsButton ? "opacity-100" : "pointer-events-none hidden opacity-0"
        }`}
        aria-hidden={!visibleSettingsButton}
        aria-label={t("settingsTitle")}
        title={t("settingsTitle")}
      >
        <Icon iconName="settings" />
      </Button>
    </div>
  );
};

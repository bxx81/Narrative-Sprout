import React, { useEffect, useLayoutEffect, useRef, ViewTransition } from "react";
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
import { applyColorScheme, resolveIsDark } from "../features/theme/api";
import { setDesktopWindowTheme } from "../features/desktop/api";
import { isDataDeletionComplete } from "../features/wipe/api";
import { playSound } from "../features/sound/api";
import {
  isViewTransitionActive,
  isViewTransitionAnimationSupported,
} from "../features/viewTransition/api";
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

/** Evaluated once: the engine brand does not change during a session. */
const viewTransitionAnimationsSupported = isViewTransitionAnimationSupported();

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
  // Before settings load from IndexedDB this falls back to "system", which
  // matches the legacy OS-following behavior; it corrects once loaded.
  const colorScheme = useGameStore((s) => s.settings?.colorScheme ?? "system");

  useEffect(() => {
    // The deletion-completion screen must not touch storage: bootstrap's
    // reads would recreate the wiped IndexedDB database. Closing the tab
    // there ends the session with nothing persisted; CompletedDataDeletion
    // Screen bootstraps itself on "Return to Title".
    if (!isDataDeletionComplete()) void bootstrap();
  }, [bootstrap]);

  // Dark mode follows the `colorScheme` setting (`system` = OS preference).
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const isDark = resolveIsDark(colorScheme, mediaQuery.matches);
      applyColorScheme(isDark);
      // `system` must pass null (OS-following), never the media-query-derived
      // value: setTheme overrides prefers-color-scheme, so reading it back
      // after a forced theme would pin the native title bar to the old mode.
      void setDesktopWindowTheme(colorScheme === "system" ? null : isDark ? "dark" : "light");
    };
    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, [colorScheme]);

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
  const routeWrapperRef = useRef<HTMLDivElement>(null);
  const routeNaturalHeightRef = useRef(0);

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

  // Keep the current scroll offset representable while the incoming screen
  // replaces a taller outgoing one: the browser would otherwise clamp the
  // scroll the moment the shorter layout commits, and the outgoing view
  // transition snapshot is anchored to the document, so it would slide with
  // the clamp. The outgoing wrapper height is remembered here as well — the
  // layout effect below replays it while the transition runs. During normal
  // browsing both values stay at or below the natural height, so this never
  // changes the layout until a transition needs it.
  useEffect(() => {
    if (!viewTransitionAnimationsSupported) return;
    const keepScrollRepresentable = () => {
      const wrapper = routeWrapperRef.current;
      if (!wrapper) return;
      wrapper.style.minHeight = `${window.scrollY + window.innerHeight}px`;
      routeNaturalHeightRef.current = wrapper.offsetHeight;
    };
    keepScrollRepresentable();
    window.addEventListener("scroll", keepScrollRepresentable, { passive: true });
    return () => window.removeEventListener("scroll", keepScrollRepresentable);
  }, []);

  // While a view transition runs, the live scroll must not move: the outgoing
  // snapshot is anchored to the document and would slide with it. The incoming
  // screen is pushed down to the current scroll offset (plus its own top
  // padding, so the offset is removed without a shift) so its snapshot
  // captures its own top while the outgoing glimpse keeps its scrolled view.
  // The wrapper height is pinned to the outgoing one too: the group animation
  // maps the snapshots through the size difference, which drifts the outgoing
  // content by a pixel at fractional device pixel ratios. The scrollbar is
  // hidden as well — the pins make the document artificially scrollable, so
  // it would point at a stale position mid-fade (the stable gutter keeps the
  // layout width unchanged). The effect below removes the pins and the scroll
  // in one frame once the animation is done, which leaves the rendered
  // position unchanged.
  useLayoutEffect(() => {
    if (!isViewTransitionActive()) return;
    const wrapper = routeWrapperRef.current;
    if (!wrapper) return;
    const currentPaddingTop = Number.parseFloat(getComputedStyle(wrapper).paddingTop) || 0;
    const pinnedHeight = Math.max(
      routeNaturalHeightRef.current,
      window.scrollY + window.innerHeight,
    );
    wrapper.style.height = `${pinnedHeight}px`;
    wrapper.style.paddingTop = `${window.scrollY + currentPaddingTop}px`;
    document.documentElement.style.overflowY = "hidden";
  }, [location.pathname]);

  // BrowserRouter does not reset the window scroll on navigation, so leaving a
  // scrolled screen (e.g. a long game) would carry that offset into the next
  // one (e.g. Settings). Reset it per route change (legacy ScrollRestoration),
  // together with the transition pins. React usually flushes this effect after
  // the animation, but an early state update (e.g. a card image resolving)
  // flushes it mid-transition, which would yank the scroll while the outgoing
  // screen still fades, so wait for the transition to finish first.
  useEffect(() => {
    const wrapper = routeWrapperRef.current;
    const releaseTransitionPins = () => {
      wrapper?.style.removeProperty("height");
      wrapper?.style.removeProperty("padding-top");
      wrapper?.style.removeProperty("min-height");
      window.scrollTo({ top: 0, behavior: "auto" });
      // After the scroll reset, so the scrollbar never paints the pinned
      // position once it comes back.
      document.documentElement.style.removeProperty("overflow-y");
    };
    if (!isViewTransitionActive()) {
      releaseTransitionPins();
      return;
    }
    const timer = setInterval(() => {
      if (!isViewTransitionActive()) {
        clearInterval(timer);
        releaseTransitionPins();
      }
    }, 30);
    return () => clearInterval(timer);
  }, [location.pathname]);

  // Full data wipe reloads the app with this flag set; show the completion
  // screen instead of the routed screen (bootstrap stays skipped too).
  if (isDataDeletionComplete()) {
    return <CompletedDataDeletionScreen />;
  }

  if (!settingsLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-body-bg">
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

  const routesContent = (
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
  );

  return (
    <div className="antialiased transition-colors duration-300 select-none">
      {viewTransitionAnimationsSupported ? (
        // The wrapper is the boundary's named node: it must be viewport-tall
        // so fixed decorations inside a screen (the title background) are not
        // clipped to the screen's own, shorter box in the snapshot.
        <ViewTransition update="route-cross-fade" default="none">
          <div ref={routeWrapperRef} className={`min-h-screen ${padding ? "p-4" : ""}`}>
            {routesContent}
          </div>
        </ViewTransition>
      ) : (
        <div
          key={location.pathname}
          className={`animate-fade-in min-h-screen motion-reduce:animate-none ${padding ? "p-4" : ""}`}
        >
          {routesContent}
        </div>
      )}

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

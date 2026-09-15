import React from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import Button from "../components/ui/Button";
import { ROUTES } from "../app/routes";
import { useGameStore } from "../store/gameStore";
import { clearDataDeletionCompleteFlag, registerServiceWorker } from "../features/wipe/api";

/**
 * Shown after the full data wipe (the store sets a sessionStorage flag and
 * reloads; the flag is consumed here). This screen recreates nothing: SW
 * registration and bootstrap stay skipped, so closing the browser or tab
 * here ends the session with no service worker, cache, or database left.
 * Returning re-registers the wiped worker and bootstraps a fresh app.
 */
const CompletedDataDeletionScreen: React.FC = () => {
  const navigate = useNavigate();
  const bootstrap = useGameStore((s) => s.bootstrap);
  const { t } = useTranslation();

  const handleReturn = () => {
    clearDataDeletionCompleteFlag();
    // First-load duties skipped on the completion screen (service worker
    // registration, bootstrap) run now: the app restarts from its factory
    // state while the title screen shows.
    void registerServiceWorker();
    void bootstrap();
    navigate(ROUTES.HOME, { replace: true, viewTransition: true });
  };

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-6 p-4 text-center">
      <h2 className="font-serif-display text-2xl font-bold md:text-3xl">
        {t("dataDeletionCompleteTitle")}
      </h2>
      <p className="support-text-color max-w-md text-sm">{t("dataDeletionCompleteDescription")}</p>
      <Button onClick={handleReturn} intent="tertiary" size="small">
        {t("returnToStartButton")}
      </Button>
    </main>
  );
};

export default CompletedDataDeletionScreen;

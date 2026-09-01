import React from "react";
import { useNavigate } from "react-router";
import Button from "../components/ui/Button";
import { ROUTES } from "../app/routes";

/**
 * Shown after the full data wipe (the store sets a sessionStorage flag and
 * reloads; the flag is consumed here).
 */
const CompletedDataDeletionScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleReturn = () => {
    sessionStorage.removeItem("nsDataDeletionComplete");
    navigate(ROUTES.HOME, { replace: true, viewTransition: true });
  };

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-6 p-4 text-center">
      <h2 className="font-serif-display text-2xl font-bold md:text-3xl">Data deletion complete</h2>
      <p className="support-text-color max-w-md text-sm">
        All save data, settings, and API keys have been removed from this browser.
      </p>
      <Button onClick={handleReturn} intent="tertiary" size="small">
        Return to Start Screen
      </Button>
    </main>
  );
};

export default CompletedDataDeletionScreen;

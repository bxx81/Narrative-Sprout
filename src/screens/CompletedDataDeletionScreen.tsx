import React from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import Button from "../components/ui/Button";
import { ROUTES } from "../app/routes";

/**
 * Shown after the full data wipe (the store sets a sessionStorage flag and
 * reloads; the flag is consumed here).
 */
const CompletedDataDeletionScreen: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleReturn = () => {
    sessionStorage.removeItem("nsDataDeletionComplete");
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

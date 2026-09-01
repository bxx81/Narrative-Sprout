import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";
import { Icon } from "../ui/Icon";

interface RefineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (refinePrompt: string) => void;
  isBusy: boolean;
}

/**
 * Refine-with-AI prompt dialog (replaces the legacy in-editor refine panel;
 * v2 creates the refined scene as a sibling branch).
 */
const RefineDialog: React.FC<RefineDialogProps> = ({ isOpen, onClose, onSubmit, isBusy }) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      inputRef.current?.focus();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const prompt = inputRef.current?.value.trim();
    if (!prompt || isBusy) return;
    onSubmit(prompt);
  };

  return (
    <dialog
      closedby="any"
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 className="h2-style">{t("refineSceneButtonLabel")}</h2>
      <p className="explanation-text-style">{t("refineScenePromptLabel")}</p>
      <textarea
        ref={inputRef}
        className="border-text-border m-0 w-full resize-y border-2 text-sm"
        rows={4}
        placeholder={t("refineScenePlaceholder")}
        disabled={isBusy}
      ></textarea>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button
          intent="circle"
          onClick={onClose}
          disabled={isBusy}
          title={t("cancelButton")}
          aria-label={t("cancelButton")}
        >
          <Icon iconName="close" />
        </Button>
        <Button
          intent="circle"
          onClick={handleSubmit}
          disabled={isBusy}
          title={t("refineSceneSubmitLabel")}
          aria-label={t("refineSceneSubmitLabel")}
        >
          <Icon iconName="auto_awesome_mosaic" />
        </Button>
      </div>
    </dialog>
  );
};

export default RefineDialog;

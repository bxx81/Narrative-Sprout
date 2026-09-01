import React, { useEffect, useRef } from "react";
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
      <h2 className="h2-style">Refine Scene with AI</h2>
      <p className="explanation-text-style">
        Describe what needs to be corrected and how. Be specific. The refined scene is added as a
        sibling branch of the current scene.
      </p>
      <textarea
        ref={inputRef}
        className="border-text-border m-0 w-full resize-y border-2 text-sm"
        rows={4}
        placeholder={
          'e.g. "The response contains English text despite being set to Japanese. Rewrite all non-Japanese parts in Japanese."'
        }
        disabled={isBusy}
      ></textarea>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button
          intent="circle"
          onClick={onClose}
          disabled={isBusy}
          title="Cancel"
          aria-label="Cancel"
        >
          <Icon iconName="close" />
        </Button>
        <Button
          intent="circle"
          onClick={handleSubmit}
          disabled={isBusy}
          title="Send to AI"
          aria-label="Send to AI"
        >
          <Icon iconName="auto_awesome_mosaic" />
        </Button>
      </div>
    </dialog>
  );
};

export default RefineDialog;

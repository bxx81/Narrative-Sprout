import React, { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ConfirmationContext,
  type ConfirmationOptions,
  type ConfirmationResult,
} from "../hooks/useConfirm";
import Button from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";

/**
 * Promise-based confirmation dialog (native <dialog> + showModal()).
 * Ported from the legacy ConfirmationContext.
 */
export const ConfirmationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<
    (ConfirmationOptions & { resolve: (val: ConfirmationResult) => void }) | null
  >(null);

  const confirm = useCallback((options: ConfirmationOptions) => {
    return new Promise<ConfirmationResult>((resolve) => {
      setConfig({ ...options, resolve });
    });
  }, []);

  const handleClose = (value: ConfirmationResult) => {
    if (config) {
      config.resolve(value);
      setConfig(null);
    }
  };

  return (
    <ConfirmationContext.Provider value={{ confirm }}>
      {children}
      {config && (
        <ConfirmationDialog
          options={config}
          onConfirm={() => handleClose(true)}
          onNeutral={() => handleClose("neutral")}
          onCancel={() => handleClose(false)}
          onDismiss={() => handleClose(null)}
        />
      )}
    </ConfirmationContext.Provider>
  );
};

const ConfirmationDialog: React.FC<{
  options: ConfirmationOptions;
  onConfirm: () => void;
  onNeutral: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}> = ({ options, onConfirm, onNeutral, onCancel, onDismiss }) => {
  const { t } = useTranslation();
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    const handleClose = () => {
      if (dialog?.open === false) {
        onDismiss();
      }
    };
    dialog?.addEventListener("close", handleClose);
    return () => dialog?.removeEventListener("close", handleClose);
  }, [onDismiss]);

  return (
    <dialog
      closedby="any"
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onDismiss();
      }}
    >
      {options.icon && <Icon iconName={options.icon} className="mb-4 w-full text-center" />}
      {options.title && (
        <h2
          className={`h2-style m-0 border-0 p-0 pb-4 ${options.icon ? "w-full text-center" : ""}`}
        >
          {options.title}
        </h2>
      )}
      <p className="support-text-color whitespace-pre-wrap">{options.message}</p>
      <div className="mt-6 flex flex-row justify-end gap-2">
        <Button intent="tertiary" size="small" onClick={onCancel}>
          {options.cancelLabel || t("cancelButton")}
        </Button>
        {!options.onlyInfo && options.neutralLabel && (
          <Button intent="tertiary" size="small" onClick={onNeutral}>
            {options.neutralLabel}
          </Button>
        )}
        {!options.onlyInfo && (
          <Button
            intent="primary"
            size="small"
            className={`${options.isDestructive ? "bg-[#ff3b30]" : ""}`}
            onClick={onConfirm}
          >
            {options.confirmLabel || t("okButton")}
          </Button>
        )}
      </div>
    </dialog>
  );
};

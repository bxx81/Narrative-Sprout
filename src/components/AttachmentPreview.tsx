import Button from "./ui/Button";
import { Icon } from "./ui/Icon";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

const AttachmentPreview: React.FC<{ file: File; onRemove: () => void }> = ({ file, onRemove }) => {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file.type.startsWith("image/")) return;

    let cancelled = false;
    const objectUrl = URL.createObjectURL(file);

    const applyUrl = async () => {
      await Promise.resolve();
      if (!cancelled) {
        setPreviewUrl(objectUrl);
      }
    };

    void applyUrl();

    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
      setPreviewUrl(null);
    };
  }, [file]);

  return (
    <div className="group animate-fade-in bg-text-bg text-body-text relative flex w-full items-center justify-between rounded-lg p-2 text-left">
      <div className="flex items-center gap-3 overflow-hidden">
        {previewUrl ? (
          // codeql[js/xss-through-dom] False positive: React escapes attribute
          // values, src is an app-created blob: URL (never a user-supplied
          // URL), and the file name is also rendered as escaped plain text
          // below. The source is the user's own file picker; nothing crosses a
          // trust boundary.
          <img
            src={previewUrl}
            alt={file.name}
            className="size-10 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="bg-body-bg flex size-10 shrink-0 items-center justify-center rounded-md">
            <Icon iconName="text_snippet" />
          </div>
        )}
        <span className="truncate text-sm" title={file.name}>
          {file.name}
        </span>
      </div>
      <Button
        intent="secondary"
        size="small-circle"
        onClick={onRemove}
        className="absolute top-1/2 right-2 -translate-y-1/2"
        aria-label={t("removeAttachmentAriaLabel", { name: file.name })}
      >
        <Icon iconName="close_small" />
      </Button>
    </div>
  );
};

export default AttachmentPreview;

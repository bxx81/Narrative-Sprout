import React, { useId } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icon";
import Button from "./Button";
import styles from "./HelpTooltip.module.css";

interface HelpTooltipProps {
  content: string;
  learnMoreUrl?: string;
  className?: string;
}

const HelpTooltipComponent: React.FC<HelpTooltipProps> = ({ content, learnMoreUrl, className }) => {
  const { t } = useTranslation();
  const popId = useId();

  return (
    <>
      <Button
        intent="secondary"
        size="help"
        className={[styles["trigger"], className].join(" ")}
        aria-label={t("moreInfoLabel")}
        popoverTarget={popId}
        style={{ "--anchor-name": `--anchor-${popId}` } as React.CSSProperties}
      >
        <Icon iconName="question_mark" className="w-5 text-base!" />
      </Button>
      <div
        popover=""
        id={popId}
        className={`${styles["popover"]} animate-fade-in border-text-border bg-text-bg rounded-lg border p-3 text-left shadow-lg`}
        style={{ "--anchor-name": `--anchor-${popId}` } as React.CSSProperties}
      >
        <div className="text-text-support text-sm">{content}</div>
        {learnMoreUrl && (
          <a
            href={learnMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary mt-2 inline-block text-sm hover:underline"
          >
            {t("learnMoreLink")}
          </a>
        )}
      </div>
    </>
  );
};

const HelpTooltip = React.memo(
  HelpTooltipComponent,
  (prevProps, nextProps) =>
    prevProps.content === nextProps.content && prevProps.learnMoreUrl === nextProps.learnMoreUrl,
);

export default HelpTooltip;

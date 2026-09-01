import React from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import Button from "./Button";
import { Icon } from "./Icon";

interface BackButtonProps {
  onClick?: () => void;
  ariaLabel?: string;
  disabled?: boolean;
}

const BackButton: React.FC<BackButtonProps> = ({ onClick, ariaLabel, disabled = false }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleBackClick = () => {
    if (disabled) return;
    if (onClick) {
      onClick();
    } else {
      navigate(-1);
    }
  };

  const label = ariaLabel || t("backButton");

  return (
    <Button
      onClick={handleBackClick}
      disabled={disabled}
      intent="navigator"
      size="medium-circle"
      className="fixed bottom-6 left-6"
      aria-label={label}
      title={label}
    >
      <Icon iconName="arrow_left_alt" />
    </Button>
  );
};

export default BackButton;

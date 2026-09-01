import { type ButtonHTMLAttributes } from "react";
import LoadingSpinner from "./LoadingSpinner";
import styles from "./Button.module.css";

export type ButtonIntent =
  | "primary"
  | "secondary"
  | "tertiary"
  | "alt"
  | "navigator"
  | "retryable"
  | "non-retryable"
  | "circle"
  | "overlay-circle"
  | "danger";
export type ButtonSize = "small" | "medium" | "large" | "medium-circle" | "small-circle" | "help";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: ButtonIntent;
  size?: ButtonSize;
  isWorking?: boolean;
}

export default function Button({
  className,
  intent = "primary",
  size,
  children = <></>,
  isWorking = false,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        styles["button-style"],
        styles[intent],
        size && styles[size],
        intent === "circle" ? styles["circle-disabled"] : styles.disabled,
        "flex items-center justify-center gap-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {isWorking ? <LoadingSpinner strokeWidth={8} /> : <></>}
      {children}
    </button>
  );
}

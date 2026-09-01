import React from "react";
import styles from "./LoadingSpinner.module.css";
/**
 * A component for displaying a loading spinner.
 * @param props.className Optional CSS classes to apply to the spinner.
 * @param props.progress Optional progress (0..1); when given the spinner
 *                       renders a progress ring instead of the animation.
 */
const LoadingSpinner: React.FC<{
  className?: string;
  progress?: number | null;
  strokeWidth?: number;
}> = ({ className = "size-6 text-current", progress = null, strokeWidth = 4 }) => {
  return (
    <svg
      className={`${progress === null ? styles["animate-spinner-rotate"] : ""} -rotate-90 ${className}`}
      viewBox="0 0 80 80"
    >
      <circle
        className={`${progress === null ? styles["animate-spinner-dash"] : ""} transition-all duration-300`}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        r="36"
        cx="40"
        cy="40"
        strokeDasharray={226.2}
        strokeDashoffset={progress === null ? 150 : 226.2 * (1 - progress)}
        strokeLinecap="round"
      />
    </svg>
  );
};

export default LoadingSpinner;
